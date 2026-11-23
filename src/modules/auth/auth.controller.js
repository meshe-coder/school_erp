const passport = require('../../config/passport');
const usersRepository = require('../users/users.repository');
const { comparePassword, hashPassword } = require('../../utils/password');

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    must_change_password: user.must_change_password,
  };
}

function login(req, res, next) {
  passport.authenticate('local', (error, user, info) => {
    if (error) return next(error);

    if (!user) {
      return res.status(401).json({
        error: info?.message || 'Invalid username or password',
      });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);

      req.login(user, (loginError) => {
        if (loginError) return next(loginError);
        return res.status(200).json({ user: publicUser(user) });
      });
    });
  })(req, res, next);
}

function logout(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);

    req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);

      res.clearCookie('sid');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  });
}

function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.status(200).json({ user: publicUser(req.user) });
}

async function changePassword(req, res, next) {
  try {
    const credentials = await usersRepository.findCredentialsById(req.user.id);

    if (!credentials) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentPasswordMatches = await comparePassword(
      req.body.currentPassword,
      credentials.password_hash
    );

    if (!currentPasswordMatches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashPassword(req.body.newPassword);
    const updatedUser = await usersRepository.updatePasswordChanged(req.user.id, passwordHash);

    if (!updatedUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);

      req.login(updatedUser, (loginError) => {
        if (loginError) return next(loginError);
        return res.status(200).json({ user: publicUser(updatedUser) });
      });
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, logout, me, changePassword, publicUser };
