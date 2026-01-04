import bcrypt from 'bcryptjs'

async function run() {
  const password = '12345'
  const hash = await bcrypt.hash(password, 10)
  console.log(hash)
}

run()

/* Para ejecutar: node src/config/genhash.js */