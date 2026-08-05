const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');

const MAX_DURATION_INCREMENT_SECONDS = 60 * 60;
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const parsePositiveInteger = (value, label) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是正整数`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}必须是正整数`);
  }
  return parsed;
};

const parseProgress = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error('学习进度必须是 0 到 100 的整数');
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('学习进度必须是 0 到 100 的整数');
  }
  return parsed;
};

const isPrivateIPv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0)
    || (a === 192 && b === 0 && parts[2] === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && parts[2] === 100)
    || (a === 203 && b === 0 && parts[2] === 113)
    || a >= 224
  );
};

const isPrivateIPv6 = (address) => {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('2001:db8:')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return net.isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  return false;
};

const isPrivateAddress = (address) => {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
};

const resolvePublicAddress = async (hostname) => {
  const normalizedHost = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!normalizedHost || normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost') || normalizedHost.endsWith('.local')) {
    throw new Error('PDF 地址不允许访问本机或内网');
  }

  if (net.isIP(normalizedHost)) {
    if (isPrivateAddress(normalizedHost)) throw new Error('PDF 地址不允许访问本机或内网');
    return { address: normalizedHost, family: net.isIP(normalizedHost) };
  }

  const addresses = await dns.lookup(normalizedHost, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error('PDF 地址解析到本机或内网');
  }
  return addresses[0];
};

const validateRemoteUrl = async (value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error('PDF URL 无效');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('PDF URL 仅支持 HTTP 或 HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('PDF URL 不允许包含认证信息');
  }
  const resolved = await resolvePublicAddress(parsed.hostname);
  return { parsed, resolved };
};

const fetchPdf = async (targetUrl, res, redirectCount = 0) => {
  if (redirectCount > MAX_REDIRECTS) throw new Error('PDF 重定向次数过多');
  const { parsed, resolved } = await validateRemoteUrl(targetUrl);
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      headers: {
        Host: parsed.host,
        'User-Agent': 'LabSafetyAccess/1.0',
        Accept: 'application/pdf,application/octet-stream;q=0.8'
      },
      servername: parsed.hostname,
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
      timeout: 15_000
    }, async (remoteResponse) => {
      const statusCode = Number(remoteResponse.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        remoteResponse.resume();
        const location = remoteResponse.headers.location;
        if (!location) return reject(new Error('PDF 重定向缺少目标地址'));
        try {
          const redirected = new URL(location, parsed).toString();
          await fetchPdf(redirected, res, redirectCount + 1);
          return resolve();
        } catch (err) {
          return reject(err);
        }
      }

      if (statusCode !== 200) {
        remoteResponse.resume();
        return reject(new Error(`远程 PDF 返回状态 ${statusCode}`));
      }

      const contentType = String(remoteResponse.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        remoteResponse.resume();
        return reject(new Error('远程内容不是 PDF'));
      }

      const contentLength = Number(remoteResponse.headers['content-length'] || 0);
      if (contentLength > MAX_PDF_BYTES) {
        remoteResponse.resume();
        return reject(new Error('PDF 文件超过 100MB 限制'));
      }

      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (contentLength > 0) res.setHeader('Content-Length', String(contentLength));

      let received = 0;
      remoteResponse.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_PDF_BYTES) {
          remoteResponse.destroy(new Error('PDF 文件超过 100MB 限制'));
        }
      });
      remoteResponse.once('error', reject);
      remoteResponse.once('end', resolve);
      remoteResponse.pipe(res);
    });

    request.once('timeout', () => request.destroy(new Error('获取 PDF 超时')));
    request.once('error', reject);
    request.end();
  });
};

const recordProgress = async (req, res) => {
  try {
    const materialId = parsePositiveInteger(req.body && req.body.id, '学习资料 ID');
    const progress = parseProgress(req.body && req.body.progress);
    const material = await dbGet('SELECT id FROM learning_materials WHERE id = ?', [materialId]);
    if (!material) return error(res, '学习资料不存在', 404);

    await dbRun(
      `INSERT INTO learning_progress (user_id, material_id, progress, study_duration)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(user_id, material_id) DO UPDATE SET
         progress = MAX(learning_progress.progress, excluded.progress),
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, materialId, progress]
    );
    const row = await dbGet(
      'SELECT progress FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [req.user.id, materialId]
    );
    return success(res, { progress: Number(row.progress || 0) }, '进度已更新');
  } catch (err) {
    if (/必须是|进度/.test(err.message || '')) return error(res, err.message, 400);
    console.error('记录学习进度错误:', err);
    return error(res, '记录学习进度失败', 500);
  }
};

const recordDuration = async (req, res) => {
  try {
    const materialId = parsePositiveInteger(req.body && req.body.id, '学习资料 ID');
    const duration = parsePositiveInteger(req.body && req.body.duration, '学习时长');
    if (duration > MAX_DURATION_INCREMENT_SECONDS) {
      return error(res, '单次学习时长不能超过 3600 秒', 400);
    }
    const material = await dbGet('SELECT id FROM learning_materials WHERE id = ?', [materialId]);
    if (!material) return error(res, '学习资料不存在', 404);

    await dbRun(
      `INSERT INTO learning_progress (user_id, material_id, progress, study_duration)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(user_id, material_id) DO UPDATE SET
         study_duration = learning_progress.study_duration + excluded.study_duration,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, materialId, duration]
    );
    const row = await dbGet(
      'SELECT study_duration FROM learning_progress WHERE user_id = ? AND material_id = ?',
      [req.user.id, materialId]
    );
    return success(res, { duration: Number(row.study_duration || 0) }, '学习时长已更新');
  } catch (err) {
    if (/必须是|学习时长/.test(err.message || '')) return error(res, err.message, 400);
    console.error('记录学习时长错误:', err);
    return error(res, '记录学习时长失败', 500);
  }
};

const proxyPdf = async (req, res) => {
  const requestedUrl = String((req.query && req.query.url) || '').trim();
  if (!requestedUrl) return error(res, '缺少 PDF URL 参数', 400);

  try {
    // Only administrator-approved learning material URLs may be proxied.
    const material = await dbGet(
      'SELECT id FROM learning_materials WHERE content = ?',
      [requestedUrl]
    );
    if (!material) return error(res, '该 PDF 地址未登记为学习资料', 403);

    await fetchPdf(requestedUrl, res);
    return undefined;
  } catch (err) {
    console.error('PDF 代理错误:', err.message);
    if (res.headersSent) {
      res.destroy(err);
      return undefined;
    }
    const status = /内网|本机|URL|重定向|不是 PDF|100MB/.test(err.message || '') ? 400 : 502;
    return error(res, err.message || '获取 PDF 失败', status);
  }
};

module.exports = {
  recordProgress,
  recordDuration,
  proxyPdf,
  parseProgress,
  parsePositiveInteger,
  isPrivateAddress,
  validateRemoteUrl
};
