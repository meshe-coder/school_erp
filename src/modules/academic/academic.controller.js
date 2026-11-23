const academicRepository = require('./academic.repository');

function handleDatabaseError(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Duplicate academic record' });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return next(error);
}

function toIsoDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

async function createYear(req, res, next) {
  try {
    const existing = await academicRepository.findYearByName(req.body.name);
    if (existing) return res.status(409).json({ error: 'Academic year name already exists' });

    const year = await academicRepository.createYear(req.body);
    return res.status(201).json({ year });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

async function listYears(req, res, next) {
  try {
    const years = await academicRepository.listYears();
    return res.status(200).json({ data: years });
  } catch (error) {
    return next(error);
  }
}

async function updateYear(req, res, next) {
  try {
    const existing = await academicRepository.findYearById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Academic year not found' });

    const startDate = req.body.startDate ?? existing.startDate;
    const endDate = req.body.endDate ?? existing.endDate;
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const year = await academicRepository.updateYear(req.params.id, req.body);
    return res.status(200).json({ year });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

async function setCurrentYear(req, res, next) {
  try {
    const year = await academicRepository.setCurrentYear(req.params.id);
    if (!year) return res.status(404).json({ error: 'Academic year not found' });

    return res.status(200).json({ year });
  } catch (error) {
    return next(error);
  }
}

async function createTerm(req, res, next) {
  try {
    const year = await academicRepository.findYearById(req.params.id);
    if (!year) return res.status(404).json({ error: 'Academic year not found' });

    const yearStart = toIsoDate(year.startDate);
    const yearEnd = toIsoDate(year.endDate);
    if (req.body.startDate < yearStart || req.body.endDate > yearEnd) {
      return res.status(400).json({ error: 'Term dates must fall inside the academic year' });
    }

    const duplicateNumber = await academicRepository.findTermByNumber(year.id, req.body.termNumber);
    if (duplicateNumber) return res.status(409).json({ error: 'A term with this number already exists' });

    const overlap = await academicRepository.findOverlappingTerm(
      year.id,
      req.body.startDate,
      req.body.endDate
    );
    if (overlap) return res.status(400).json({ error: 'Term dates overlap another term' });

    const term = await academicRepository.createTerm(year.id, req.body);
    return res.status(201).json({ term });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

async function updateTerm(req, res, next) {
  try {
    const existing = await academicRepository.findTermById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Term not found' });

    const year = await academicRepository.findYearById(existing.academicYearId);
    const startDate = req.body.startDate ?? existing.startDate;
    const endDate = req.body.endDate ?? existing.endDate;

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    if (startDate < toIsoDate(year.startDate) || endDate > toIsoDate(year.endDate)) {
      return res.status(400).json({ error: 'Term dates must fall inside the academic year' });
    }

    if (req.body.termNumber !== undefined) {
      const duplicateNumber = await academicRepository.findTermByNumber(
        existing.academicYearId,
        req.body.termNumber
      );
      if (duplicateNumber && duplicateNumber.id !== existing.id) {
        return res.status(409).json({ error: 'A term with this number already exists' });
      }
    }

    const overlap = await academicRepository.findOverlappingTerm(
      existing.academicYearId,
      startDate,
      endDate,
      existing.id
    );
    if (overlap) return res.status(400).json({ error: 'Term dates overlap another term' });

    const term = await academicRepository.updateTerm(existing.id, req.body);
    return res.status(200).json({ term });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

async function setCurrentTerm(req, res, next) {
  try {
    const term = await academicRepository.setCurrentTerm(req.params.id);
    if (!term) return res.status(404).json({ error: 'Term not found' });
    return res.status(200).json({ term });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

async function getCurrentAcademic(req, res, next) {
  try {
    const current = await academicRepository.getCurrentAcademic();
    return res.status(200).json(current);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createYear,
  listYears,
  updateYear,
  setCurrentYear,
  createTerm,
  updateTerm,
  setCurrentTerm,
  getCurrentAcademic,
};
