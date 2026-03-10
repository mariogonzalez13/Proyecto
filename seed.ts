import { createUser } from './backend/auth';

async function seed() {
  const result = await createUser('admin', 'admin@admin.com', 'admin123', '127.0.0.1', 1);
  console.log(result);
}

seed();
