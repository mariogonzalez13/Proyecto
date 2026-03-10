const { createUser } = require('./dist-server/auth.js');

async function seed() {
  try {
    const result = await createUser('admin', 'admin@admin.com', 'admin123', '127.0.0.1', 1);
    console.log(result);
  } catch(e) {
    console.error(e);
  }
}

seed();
