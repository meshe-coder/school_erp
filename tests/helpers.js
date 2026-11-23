const API_HEADER = {
  'X-Requested-With': 'school-erp',
};

function apiRequest(test) {
  return test.set(API_HEADER);
}

module.exports = { API_HEADER, apiRequest };
