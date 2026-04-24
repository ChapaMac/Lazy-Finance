import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  timeout: 120000, // 2 min — AI parser needs more time for large PDFs
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
