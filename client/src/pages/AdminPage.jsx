import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as adminApi from '../api/admin';
import '../styles/admin.css';

function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appointments');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-container">
      <div className="admin-wrapper">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-title">
            <h1>Admin Dashboard</h1>
            <p className="admin-header-subtitle">{user?.name} • Administrator</p>
          </div>
          <div className="admin-header-actions">
            <button onClick={() => navigate('/chat')} className="btn btn-secondary">
              Go to Chat
            </button>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            Appointments
          </button>
          <button
            className={`admin-tab ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            Doctors
          </button>
          <button
            className={`admin-tab ${activeTab === 'specializations' ? 'active' : ''}`}
            onClick={() => setActiveTab('specializations')}
          >
            Specializations
          </button>
          <button
            className={`admin-tab ${activeTab === 'slots' ? 'active' : ''}`}
            onClick={() => setActiveTab('slots')}
          >
            Slots
          </button>
        </div>

        {/* Content */}
        <div className="admin-content">
          {activeTab === 'appointments' && <AppointmentsTab />}
          {activeTab === 'doctors' && <DoctorsTab />}
          {activeTab === 'specializations' && <SpecializationsTab />}
          {activeTab === 'slots' && <SlotsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Appointments Tab ─────────────────────────────────────────────────────────

function AppointmentsTab() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    bookingId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadAppointments();
  }, [filters.page, filters.status]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getAppointments(filters);
      setAppointments(response.data || []);
      setPagination(response.pagination || {});
    } catch (error) {
      console.error('Failed to load appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters({ ...filters, page: 1 });
    loadAppointments();
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      bookingId: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 10
    });
    setTimeout(loadAppointments, 0);
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      await adminApi.cancelAppointment(selectedAppointment._id, cancelReason);
      setShowCancelModal(false);
      setSelectedAppointment(null);
      setCancelReason('');
      loadAppointments();
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
      alert(error.message || 'Failed to cancel appointment');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="admin-filters">
        <div className="filter-group">
          <label>Booking ID</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Search by booking ID"
            value={filters.bookingId}
            onChange={(e) => setFilters({ ...filters, bookingId: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Date From</label>
          <input
            type="date"
            className="filter-input"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Date To</label>
          <input
            type="date"
            className="filter-input"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
          <button className="btn btn-secondary" onClick={handleClearFilters}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      {appointments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-message">No appointments found</p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Specialization</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {apt.bookingId}
                    </td>
                    <td>
                      <div>{apt.user?.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {apt.user?.email}
                      </div>
                    </td>
                    <td>{apt.doctor?.name}</td>
                    <td>{apt.specialization?.name}</td>
                    <td>
                      <div>{apt.date}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {apt.startTime} - {apt.endTime}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${apt.status.toLowerCase()}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {apt.status !== 'CANCELLED' && (
                          <button
                            className="action-btn danger"
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowCancelModal(true);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <div className="pagination-info">
              Showing {((pagination.page - 1) * filters.limit) + 1} to{' '}
              {Math.min(pagination.page * filters.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="pagination-buttons">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= pagination.pages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Appointment</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                Booking ID: {selectedAppointment?.bookingId}
              </p>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Cancellation Reason (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Enter reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                Close
              </button>
              <button className="btn btn-danger" onClick={handleCancelAppointment}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Doctors Tab ──────────────────────────────────────────────────────────────

function DoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    location: '',
    experience: '',
    qualification: '',
    status: 'ACTIVE'
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadDoctors();
    loadSpecializations();
  }, [currentPage]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getDoctors({ page: currentPage, limit: 10 });
      setDoctors(response.data || []);
      setPagination(response.pagination || {});
    } catch (error) {
      console.error('Failed to load doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecializations = async () => {
    try {
      const response = await adminApi.getSpecializations({ limit: 100 });
      setSpecializations(response.data || []);
    } catch (error) {
      console.error('Failed to load specializations:', error);
    }
  };

  const handleOpenModal = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        name: doctor.name,
        specialization: doctor.specialization._id || doctor.specialization,
        location: doctor.location,
        experience: doctor.experience,
        qualification: doctor.qualification || '',
        status: doctor.status
      });
    } else {
      setEditingDoctor(null);
      setFormData({
        name: '',
        specialization: '',
        location: '',
        experience: '',
        qualification: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await adminApi.updateDoctor(editingDoctor._id, formData);
      } else {
        await adminApi.createDoctor(formData);
      }
      setShowModal(false);
      loadDoctors();
    } catch (error) {
      console.error('Failed to save doctor:', error);
      alert(error.message || 'Failed to save doctor');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Are you sure you want to deactivate this doctor?')) return;
    try {
      await adminApi.deactivateDoctor(id);
      loadDoctors();
    } catch (error) {
      console.error('Failed to deactivate doctor:', error);
      alert(error.message || 'Failed to deactivate doctor');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add Doctor
        </button>
      </div>

      {doctors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍⚕️</div>
          <p className="empty-state-message">No doctors found</p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Location</th>
                  <th>Experience</th>
                  <th>Qualification</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor._id}>
                    <td>{doctor.name}</td>
                    <td>{doctor.specialization?.name}</td>
                    <td>{doctor.location}</td>
                    <td>{doctor.experience} years</td>
                    <td>{doctor.qualification || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${doctor.status.toLowerCase()}`}>
                        {doctor.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          onClick={() => handleOpenModal(doctor)}
                        >
                          Edit
                        </button>
                        {doctor.status === 'ACTIVE' && (
                          <button
                            className="action-btn danger"
                            onClick={() => handleDeactivate(doctor._id)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pagination-info">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="pagination-buttons">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= pagination.pages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Doctor Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization *</label>
                  <select
                    className="form-select"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    required
                  >
                    <option value="">Select specialization</option>
                    {specializations.map((spec) => (
                      <option key={spec._id} value={spec._id}>
                        {spec.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Experience (years) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Qualification</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDoctor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Specializations Tab ──────────────────────────────────────────────────────

function SpecializationsTab() {
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    aliases: '',
    description: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    loadSpecializations();
  }, []);

  const loadSpecializations = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getSpecializations({ limit: 100 });
      setSpecializations(response.data || []);
    } catch (error) {
      console.error('Failed to load specializations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (spec = null) => {
    if (spec) {
      setEditingSpec(spec);
      setFormData({
        name: spec.name,
        slug: spec.slug,
        aliases: spec.aliases?.join(', ') || '',
        description: spec.description || '',
        status: spec.status
      });
    } else {
      setEditingSpec(null);
      setFormData({
        name: '',
        slug: '',
        aliases: '',
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        aliases: formData.aliases.split(',').map(a => a.trim()).filter(Boolean)
      };
      if (editingSpec) {
        await adminApi.updateSpecialization(editingSpec._id, submitData);
      } else {
        await adminApi.createSpecialization(submitData);
      }
      setShowModal(false);
      loadSpecializations();
    } catch (error) {
      console.error('Failed to save specialization:', error);
      alert(error.message || 'Failed to save specialization');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Are you sure you want to deactivate this specialization?')) return;
    try {
      await adminApi.deactivateSpecialization(id);
      loadSpecializations();
    } catch (error) {
      console.error('Failed to deactivate specialization:', error);
      alert(error.message || 'Failed to deactivate specialization');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add Specialization
        </button>
      </div>

      {specializations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <p className="empty-state-message">No specializations found</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Aliases</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {specializations.map((spec) => (
                <tr key={spec._id}>
                  <td>{spec.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                    {spec.slug}
                  </td>
                  <td>{spec.aliases?.join(', ') || 'None'}</td>
                  <td>{spec.description || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${spec.status.toLowerCase()}`}>
                      {spec.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn"
                        onClick={() => handleOpenModal(spec)}
                      >
                        Edit
                      </button>
                      {spec.status === 'ACTIVE' && (
                        <button
                          className="action-btn danger"
                          onClick={() => handleDeactivate(spec._id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Specialization Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSpec ? 'Edit Specialization' : 'Add New Specialization'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                    disabled={!!editingSpec}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Aliases (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.aliases}
                    onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                    placeholder="e.g., skin doctor, dermatologist"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSpec ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Slots Tab ────────────────────────────────────────────────────────────────

function SlotsTab() {
  const [slots, setSlots] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [filters, setFilters] = useState({
    doctorId: '',
    date: '',
    status: '',
    page: 1,
    limit: 20
  });
  const [formData, setFormData] = useState({
    doctorId: '',
    date: '',
    startTime: '',
    endTime: ''
  });
  const [bulkFormData, setBulkFormData] = useState({
    doctorId: '',
    dateFrom: '',
    dateTo: '',
    startTime: '09:00',
    endTime: '17:00',
    durationMinutes: 30
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadSlots();
    loadDoctors();
  }, [filters.page, filters.doctorId, filters.status]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getSlots(filters);
      setSlots(response.data || []);
      setPagination(response.pagination || {});
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const response = await adminApi.getDoctors({ limit: 100 });
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createSlot(formData);
      setShowModal(false);
      setFormData({ doctorId: '', date: '', startTime: '', endTime: '' });
      loadSlots();
    } catch (error) {
      console.error('Failed to create slot:', error);
      alert(error.message || 'Failed to create slot');
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    try {
      await adminApi.bulkCreateSlots(bulkFormData);
      setShowBulkModal(false);
      loadSlots();
    } catch (error) {
      console.error('Failed to create slots:', error);
      alert(error.message || 'Failed to create slots');
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;
    try {
      await adminApi.deleteSlot(id);
      loadSlots();
    } catch (error) {
      console.error('Failed to delete slot:', error);
      alert(error.message || 'Failed to delete slot');
    }
  };

  const handleClearFilters = () => {
    setFilters({
      doctorId: '',
      date: '',
      status: '',
      page: 1,
      limit: 20
    });
    setTimeout(loadSlots, 0);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Single Slot
        </button>
        <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
          + Bulk Create Slots
        </button>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <div className="filter-group">
          <label>Doctor</label>
          <select
            className="filter-select"
            value={filters.doctorId}
            onChange={(e) => setFilters({ ...filters, doctorId: e.target.value, page: 1 })}
          >
            <option value="">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc._id} value={doc._id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Date</label>
          <input
            type="date"
            className="filter-input"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value, page: 1 })}
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="BOOKED">Booked</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-secondary" onClick={handleClearFilters}>
            Clear
          </button>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-message">No slots found</p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot._id}>
                    <td>{slot.doctor?.name}</td>
                    <td>{slot.date}</td>
                    <td>{slot.startTime}</td>
                    <td>{slot.endTime}</td>
                    <td>
                      <span className={`status-badge ${slot.status.toLowerCase()}`}>
                        {slot.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {slot.status !== 'BOOKED' && (
                          <button
                            className="action-btn danger"
                            onClick={() => handleDeleteSlot(slot._id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pagination-info">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="pagination-buttons">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= pagination.pages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Single Slot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Single Slot</h2>
            </div>
            <form onSubmit={handleCreateSlot}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Doctor *</label>
                  <select
                    className="form-select"
                    value={formData.doctorId}
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                    required
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Create Slots</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                Generate multiple slots for a doctor over a date range
              </p>
            </div>
            <form onSubmit={handleBulkCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Doctor *</label>
                  <select
                    className="form-select"
                    value={bulkFormData.doctorId}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, doctorId: e.target.value })}
                    required
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date From *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bulkFormData.dateFrom}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, dateFrom: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date To *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bulkFormData.dateTo}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, dateTo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={bulkFormData.startTime}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={bulkFormData.endTime}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, endTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slot Duration (minutes) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={bulkFormData.durationMinutes}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, durationMinutes: e.target.value })}
                    required
                    min="15"
                    step="15"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate Slots
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminPage;
