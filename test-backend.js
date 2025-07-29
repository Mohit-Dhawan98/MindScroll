// Quick test to see if backend starts without errors
import { spawn } from 'child_process'

console.log('🧪 Testing backend startup...')

const backend = spawn('npm', ['run', 'dev'], {
  cwd: './backend',
  stdio: 'pipe'
})

let output = ''

backend.stdout.on('data', (data) => {
  output += data.toString()
  console.log(data.toString().trim())
})

backend.stderr.on('data', (data) => {
  console.error('Error:', data.toString().trim())
})

// Test for 5 seconds then kill
setTimeout(() => {
  backend.kill('SIGTERM')
  
  if (output.includes('MindScroll API server running')) {
    console.log('✅ Backend started successfully!')
    console.log('Run "npm run dev" to start both frontend and backend')
  } else {
    console.log('❌ Backend startup failed')
  }
  
  process.exit(0)
}, 5000)