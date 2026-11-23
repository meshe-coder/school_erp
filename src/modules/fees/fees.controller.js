const db = require('../../config/db');
const feesRepository = require('./fees.repository');
const feesService = require('./fees.service');

async function getClassFees(req, res, next) {
  try {
    const term = await feesRepository.findTermById(req.params.termId);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    const data = await feesRepository.listClassFees(req.params.termId);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function putClassFees(req, res, next) {
  try {
    const data = await feesService.setManyClassFees(
      req.params.termId,
      req.body.fees,
      req.user.id
    );
    return res.status(200).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
}

async function deleteClassFee(req, res, next) {
  try {
    const term = await feesRepository.findTermById(req.params.termId);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    const deleted = await feesRepository.deleteClassFee(req.params.termId, req.params.classId);
    if (!deleted) return res.status(404).json({ error: 'Class fee not found' });

    // Changing fees does not change existing bills until bills are regenerated with refresh.
    return res.status(200).json({ message: 'Class fee deleted' });
  } catch (error) {
    return next(error);
  }
}

async function putStudentOverride(req, res, next) {
  try {
    const effectiveFee = await feesService.setStudentOverride(
      req.params.id,
      req.body.termId,
      req.body.amount,
      req.body.reason,
      req.user.id
    );
    return res.status(200).json(effectiveFee);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
}

async function deleteStudentOverride(req, res, next) {
  try {
    const student = await db.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
    if (!student.rows.length) return res.status(404).json({ error: 'Student not found' });

    const term = await feesRepository.findTermById(req.query.termId);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    await feesRepository.deleteOverride(req.params.id, req.query.termId);

    // Changing fees does not change existing bills until bills are regenerated with refresh.
    const effectiveFee = await feesRepository.findEffectiveFee(req.params.id, req.query.termId);
    return res.status(200).json(effectiveFee);
  } catch (error) {
    return next(error);
  }
}

async function getStudentFee(req, res, next) {
  try {
    const student = await db.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
    if (!student.rows.length) return res.status(404).json({ error: 'Student not found' });

    let termId = req.query.termId;
    if (!termId) {
      const currentTerm = await feesRepository.findCurrentTerm();
      if (!currentTerm) return res.status(400).json({ error: 'No current term is set' });
      termId = currentTerm.id;
    } else {
      const term = await feesRepository.findTermById(termId);
      if (!term) return res.status(404).json({ error: 'Term not found' });
    }

    const fee = await feesRepository.findEffectiveFee(req.params.id, termId);
    return res.status(200).json(fee);
  } catch (error) {
    return next(error);
  }
}

async function getStudentFeesOverview(req, res, next) {
  try {
    const term = await feesRepository.findTermById(req.params.termId);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    const result = await feesRepository.listStudentFees(req.params.termId, {
      page: req.query.page,
      limit: req.query.limit,
      classId: req.query.classId,
      search: req.query.search,
      missingFee: req.query.missingFee,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOwnFee(req, res, next) {
  try {
    const currentTerm = await feesRepository.findCurrentTerm();
    if (!currentTerm) {
      return res.status(200).json({ available: false, reason: 'No current term is set' });
    }

    const student = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
    if (!student.rows.length) {
      return res.status(200).json({ available: false, reason: 'Student profile was not found' });
    }

    const fee = await feesRepository.findEffectiveFee(student.rows[0].id, currentTerm.id);
    if (!fee || !fee.effectiveFee) {
      return res.status(200).json({ available: false, reason: 'No fee is set for your class and term' });
    }

    return res.status(200).json({
      available: true,
      termName: currentTerm.name,
      className: fee.className,
      effectiveFee: fee.effectiveFee,
      source: fee.source,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getClassFees,
  putClassFees,
  deleteClassFee,
  putStudentOverride,
  deleteStudentOverride,
  getStudentFee,
  getStudentFeesOverview,
  getOwnFee,
};
