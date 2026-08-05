import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Question {
  id: string
  type: 'single' | 'multiple' | 'judge'
  content: string
  options: string[]
  answer?: string | string[]
}

export interface ExamInfo {
  id: string
  title: string
  duration: number // 考试时长（分钟）
  totalScore: number
  passScore: number
  questionCount: number
}

export const useExamStore = defineStore('exam', () => {
  const currentExam = ref<ExamInfo | null>(null)
  const questions = ref<Question[]>([])
  const answers = ref<Record<string, string | string[]>>({})
  const remainingTime = ref<number>(0)

  function setExam(exam: ExamInfo) {
    currentExam.value = exam
    remainingTime.value = exam.duration * 60 // 转为秒
  }

  function setQuestions(list: Question[]) {
    questions.value = list
  }

  function setAnswer(questionId: string, answer: string | string[]) {
    answers.value[questionId] = answer
  }

  function clearExam() {
    currentExam.value = null
    questions.value = []
    answers.value = {}
    remainingTime.value = 0
  }

  return {
    currentExam,
    questions,
    answers,
    remainingTime,
    setExam,
    setQuestions,
    setAnswer,
    clearExam
  }
})

