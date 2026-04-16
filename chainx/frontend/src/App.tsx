import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">ChainX</h1>
      <p className="text-xl mb-8">Initialized React + Vite + Tailwind</p>
      <button 
        onClick={() => setCount((count) => count + 1)}
        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
      >
        count is {count}
      </button>
    </div>
  )
}

export default App
