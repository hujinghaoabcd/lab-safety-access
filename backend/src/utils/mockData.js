const { v4: uuidv4 } = require('uuid');

/**
 * Mock 数据存储
 * 实际项目中应使用数据库
 */

// 用户数据
const users = [
  {
    id: '1',
    username: '2024001001',
    password: '123456',
    name: '张三',
    studentId: '2024001001',
    department: '化学与材料科学学院',
    phone: '13888888888',
    email: 'zhangsan@edu.cn',
    avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
  },
  {
    id: '2',
    username: '2024001002',
    password: '123456',
    name: '李四',
    studentId: '2024001002',
    department: '物理与电子科学学院',
    phone: '13999999999',
    email: 'lisi@edu.cn',
    avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
  }
];

// 学习资料
const learningMaterials = [
  {
    id: '1',
    title: '实验室安全基础知识',
    description: '了解实验室基本安全规范和操作要求',
    content: '实验室安全是科研工作的重要保障...',
    duration: '30分钟',
    category: '基础安全',
    order: 1
  },
  {
    id: '2',
    title: '化学试剂安全使用',
    description: '掌握化学试剂的正确使用和存储方法',
    content: '化学试剂的正确使用是保障实验安全的关键...',
    duration: '45分钟',
    category: '化学安全',
    order: 2
  },
  {
    id: '3',
    title: '实验室消防安全',
    description: '学习消防设施使用和火灾应急处理',
    content: '消防安全知识是每位实验人员必须掌握的...',
    duration: '25分钟',
    category: '消防安全',
    order: 3
  }
];

// 学习进度
const learningProgress = {};

// 考试列表
const exams = [
  {
    id: '1',
    title: '实验室安全综合考试',
    description: '涵盖实验室安全各方面知识的综合性考核',
    duration: 60,
    questionCount: 50,
    passScore: 80,
    totalScore: 100,
    maxAttempts: 3
  },
  {
    id: '2',
    title: '化学安全专项考试',
    description: '化学试剂使用、存储及应急处理专项考核',
    duration: 45,
    questionCount: 30,
    passScore: 70,
    totalScore: 100,
    maxAttempts: 3
  },
  {
    id: '3',
    title: '消防安全考试',
    description: '消防设施使用和火灾应急处理考核',
    duration: 30,
    questionCount: 20,
    passScore: 80,
    totalScore: 100,
    maxAttempts: 3
  }
];

// 题库
const questions = [
  {
    id: '1',
    examId: '1',
    type: 'single',
    content: '实验室发生火灾时，应首先采取什么措施？',
    options: ['A. 立即使用灭火器灭火', 'B. 迅速撤离并报警', 'C. 打开窗户通风', 'D. 继续实验'],
    answer: 'B',
    score: 2
  },
  {
    id: '2',
    examId: '1',
    type: 'single',
    content: '以下哪种物质不能直接倒入下水道？',
    options: ['A. 纯净水', 'B. 有机溶剂', 'C. 生理盐水', 'D. 蒸馏水'],
    answer: 'B',
    score: 2
  },
  {
    id: '3',
    examId: '1',
    type: 'multiple',
    content: '以下哪些是正确的实验室安全操作？（多选）',
    options: ['A. 穿戴实验服和护目镜', 'B. 熟悉消防器材位置', 'C. 实验结束后清理工作台', 'D. 独自进行危险实验'],
    answer: ['A', 'B', 'C'],
    score: 4
  },
  {
    id: '4',
    examId: '1',
    type: 'judge',
    content: '实验室可以存放私人食品和饮料。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'B',
    score: 2
  },
  {
    id: '5',
    examId: '1',
    type: 'single',
    content: '化学试剂溅入眼睛后，正确的处理方法是？',
    options: ['A. 揉眼睛', 'B. 用大量清水冲洗至少15分钟', 'C. 滴眼药水', 'D. 等待自然恢复'],
    answer: 'B',
    score: 2
  }
];

// 考试记录
const examRecords = [
  {
    id: '1',
    oderId: '1',
    examId: '1',
    examTitle: '实验室安全综合考试',
    score: 85,
    totalScore: 100,
    passed: true,
    correctCount: 42,
    wrongCount: 8,
    duration: '45分32秒',
    submitTime: '2024-01-15 14:30:00',
    answers: {}
  }
];

// 错题记录
const wrongQuestions = [];

// 准入资格
const qualifications = [
  {
    id: '1',
    userId: '1',
    labName: '化学实验室A区',
    labType: '化学类',
    status: 'qualified',
    qualifiedDate: '2024-01-15',
    expireDate: '2025-01-15',
    examScore: 85
  }
];

// 证书
const certificates = [
  {
    id: '1',
    userId: '1',
    title: '实验室安全准入合格证书',
    labName: '化学实验室A区',
    issueDate: '2024-01-15',
    expireDate: '2025-01-15',
    certificateNo: 'LAB-2024-001001'
  }
];

module.exports = {
  users,
  learningMaterials,
  learningProgress,
  exams,
  questions,
  examRecords,
  wrongQuestions,
  qualifications,
  certificates,
  uuidv4
};

