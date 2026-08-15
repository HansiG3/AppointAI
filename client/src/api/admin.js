import apiClient from './client';

// ─── Appointments ─────────────────────────────────────────────────────────────

export const getAppointments = (params = {}) => {
  return apiClient.get('/admin/appointments', { params });
};

export const getAppointmentById = (id) => {
  return apiClient.get(`/admin/appointments/${id}`);
};

export const rescheduleAppointment = (id, slotId) => {
  return apiClient.put(`/admin/appointments/${id}`, { slotId });
};

export const cancelAppointment = (id, reason = '') => {
  return apiClient.delete(`/admin/appointments/${id}`, { data: { reason } });
};

// ─── Doctors ──────────────────────────────────────────────────────────────────

export const getDoctors = (params = {}) => {
  return apiClient.get('/admin/doctors', { params });
};

export const createDoctor = (doctorData) => {
  return apiClient.post('/admin/doctors', doctorData);
};

export const updateDoctor = (id, doctorData) => {
  return apiClient.put(`/admin/doctors/${id}`, doctorData);
};

export const deactivateDoctor = (id) => {
  return apiClient.delete(`/admin/doctors/${id}`);
};

// ─── Specializations ──────────────────────────────────────────────────────────

export const getSpecializations = (params = {}) => {
  return apiClient.get('/admin/specializations', { params });
};

export const createSpecialization = (specData) => {
  return apiClient.post('/admin/specializations', specData);
};

export const updateSpecialization = (id, specData) => {
  return apiClient.put(`/admin/specializations/${id}`, specData);
};

export const deactivateSpecialization = (id) => {
  return apiClient.delete(`/admin/specializations/${id}`);
};

// ─── Slots ────────────────────────────────────────────────────────────────────

export const getSlots = (params = {}) => {
  return apiClient.get('/admin/slots', { params });
};

export const createSlot = (slotData) => {
  return apiClient.post('/admin/slots', slotData);
};

export const bulkCreateSlots = (bulkData) => {
  return apiClient.post('/admin/slots/bulk', bulkData);
};

export const updateSlot = (id, slotData) => {
  return apiClient.put(`/admin/slots/${id}`, slotData);
};

export const deleteSlot = (id) => {
  return apiClient.delete(`/admin/slots/${id}`);
};
