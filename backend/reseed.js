const http = require('http');

const data = JSON.stringify({
  usersPerClass: 10,
  examsCount: 10,
  questionsPerExam: 50
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/admin/reseed',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('响应状态:', res.statusCode);
    console.log('响应内容:', body);
    try {
      const result = JSON.parse(body);
      if (result.code === 0) {
        console.log('\n✅ 重置成功！');
        console.log('统计信息:');
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log('\n❌ 重置失败:', result.message);
      }
    } catch (e) {
      console.log('响应解析失败:', e.message);
    }
    process.exit(res.statusCode === 200 && JSON.parse(body).code === 0 ? 0 : 1);
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
  process.exit(1);
});

req.write(data);
req.end();

