const crypto = require('crypto');
const usersRepository = require('./users.repository');
const { hashPassword } = require('../../utils/password');

function generateTemporaryPassword() {
  return `${crypto.randomBytes(6).toString('base64url')}A1`;
}

async function createUser(req, res, next) {
  try {
    const duplicateUsername = await usersRepository.findByUsername(req.body.username);
    if (duplicateUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    if (req.body.email) {
      const duplicateEmail = await usersRepository.findByEmail(req.body.email);
      if (duplicateEmail) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const temporaryPassword = req.body.password || generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const user = await usersRepository.createUser({
      username: req.body.username,
      email: req.body.email,
      passwordHash,
      role: req.body.role,
      createdBy: req.user.id,
    });

    const response = { user };
    if (!req.body.password) {
      response.temporaryPassword = temporaryPassword;
    }

    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const result = await usersRepository.listUsers(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await usersRepository.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const isSelf = req.params.id === req.user.id;

    if (isSelf && req.body.isActive === false) {
      return res.status(403).json({ error: 'You cannot deactivate your own account' });
    }

    if (isSelf && req.body.role && req.body.role !== req.user.role) {
      return res.status(403).json({ error: 'You cannot demote or change your own role' });
    }

    const user = await usersRepository.updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.body.isActive === false) {
      await usersRepository.deleteUserSessions(req.params.id);
    }

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const user = await usersRepository.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await usersRepository.updatePassword(req.params.id, passwordHash);
    await usersRepository.deleteUserSessions(req.params.id);

    return res.status(200).json({ temporaryPassword });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  resetPassword,
};
