const env = require('../src/config/env');
const db = require('../src/config/db');
const usersRepository = require('../src/modules/users/users.repository');
const { hashPassword } = require('../src/utils/password');
const ROLES = require('../src/utils/roles');

async function seedAdmin() {
  const existing = await usersRepository.findByUsername(env.seedAdminUsername);

  if (existing) {
    console.log(`Admin already exists: ${env.seedAdminUsername}`);
    return;
  }

  const passwordHash = await hashPassword(env.seedAdminPassword);
  await usersRepository.createUser({
    username: env.seedAdminUsername.trim().toLowerCase(),
    email: env.seedAdminEmail.trim().toLowerCase(),
    passwordHash,
    role: ROLES.ADMIN,
    createdBy: null,
  });

  console.log(`Seeded admin: ${env.seedAdminUsername}`);
}

seedAdmin()
  .then(() => db.pool.end())
  .catch((error) => {
    console.error(error.message);
    db.pool.end().finally(() => process.exit(1));
  });
