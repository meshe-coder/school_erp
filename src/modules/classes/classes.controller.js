const classesRepository = require('./classes.repository');

async function createGradeLevel(req, res, next) {
  try {
    const existing = await classesRepository.findGradeLevelByName(req.body.name);
    if (existing) return res.status(409).json({ error: 'Grade level name already exists' });

    const level = await classesRepository.createGradeLevel(req.body);
    return res.status(201).json({ gradeLevel: level });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Grade level name already exists' });
    return next(error);
  }
}

async function listGradeLevels(req, res, next) {
  try {
    const levels = await classesRepository.listGradeLevels();
    return res.status(200).json({ data: levels });
  } catch (error) {
    return next(error);
  }
}

async function updateGradeLevel(req, res, next) {
  try {
    const existing = await classesRepository.findGradeLevelById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Grade level not found' });

    const level = await classesRepository.updateGradeLevel(req.params.id, req.body);
    return res.status(200).json({ gradeLevel: level });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Grade level name already exists' });
    return next(error);
  }
}

async function createClass(req, res, next) {
  try {
    const year = await classesRepository.findAcademicYearById(req.body.academicYearId);
    if (!year) return res.status(400).json({ error: 'Academic year does not exist' });

    const level = await classesRepository.findGradeLevelById(req.body.gradeLevelId);
    if (!level) return res.status(400).json({ error: 'Grade level does not exist' });

    const schoolClass = await classesRepository.createClass(req.body);
    return res.status(201).json({ class: schoolClass });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Class name already exists for this academic year' });
    return next(error);
  }
}

async function listClasses(req, res, next) {
  try {
    let academicYearId = req.query.academicYearId;

    if (!academicYearId) {
      const currentYear = await classesRepository.findCurrentAcademicYear();
      academicYearId = currentYear?.id;
    }

    const classes = await classesRepository.listClasses({
      academicYearId,
      gradeLevelId: req.query.gradeLevelId,
    });
    return res.status(200).json({ data: classes });
  } catch (error) {
    return next(error);
  }
}

async function updateClass(req, res, next) {
  try {
    const existing = await classesRepository.findClassById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const schoolClass = await classesRepository.updateClass(req.params.id, req.body);
    return res.status(200).json({ class: schoolClass });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Class name already exists for this academic year' });
    return next(error);
  }
}

async function deleteClass(req, res, next) {
  try {
    const existing = await classesRepository.findClassById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const enrollmentCount = await classesRepository.countEnrollments(req.params.id);
    if (enrollmentCount > 0) {
      return res.status(409).json({ error: 'Class cannot be deleted because it has enrollments' });
    }

    await classesRepository.deleteClass(req.params.id);
    return res.status(200).json({ message: 'Class deleted' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createGradeLevel,
  listGradeLevels,
  updateGradeLevel,
  createClass,
  listClasses,
  updateClass,
  deleteClass,
};
