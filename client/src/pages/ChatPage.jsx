import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import '../styles/chat.css';

function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      message:
        `Hi ${user?.name || ''}! 👋 I'm AppointAI, your appointment booking assistant. ` +
        'Tell me what kind of doctor you need, your preferred date or time, and I will help you find an appointment.',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // Available appointment slots
  const [options, setOptions] = useState([]);

  // Currently confirmed appointment
  const [appointment, setAppointment] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, loading, options, appointment]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /*
   * Convert "9 AM", "09:00", "9:30 AM", etc.
   * into minutes from midnight.
   */
  const parseTimeToMinutes = (time) => {
    if (!time) return null;

    const value = time
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 24-hour format: 09:30
    const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/);

    if (twentyFourHour) {
      const hours = Number(twentyFourHour[1]);
      const minutes = Number(twentyFourHour[2]);

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 60 + minutes;
      }
    }

    // 12-hour format: 9 AM / 9:30 AM
    const twelveHour = value.match(
      /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/
    );

    if (twelveHour) {
      let hours = Number(twelveHour[1]);
      const minutes = Number(twelveHour[2] || 0);
      const period = twelveHour[3];

      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        return null;
      }

      if (period === 'am') {
        if (hours === 12) hours = 0;
      } else {
        if (hours !== 12) hours += 12;
      }

      return hours * 60 + minutes;
    }

    return null;
  };

  /*
   * Try to identify a slot from natural language.
   *
   * Example:
   * "Dr. Arjun Rao at 9:30 AM"
   *
   * We ONLY match an exact available start time.
   * We do NOT turn "9 AM" into "9:30 AM".
   */
  const findSlotFromMessage = (messageText, availableSlots) => {
    if (!messageText || !availableSlots?.length) {
      return null;
    }

    const text = messageText
      .toLowerCase()
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    /*
     * Find doctor name.
     */
    const doctorMatch = availableSlots.find((slot) => {
      if (!slot.doctorName) return false;

      const doctorName = slot.doctorName
        .toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      /*
       * Support:
       * "Dr Arjun Rao"
       * "Dr. Arjun Rao"
       * "Arjun Rao"
       */
      const withoutDr = doctorName
        .replace(/^dr\s+/, '')
        .trim();

      return (
        text.includes(doctorName) ||
        text.includes(withoutDr)
      );
    });

    /*
     * Find a time in the user's message.
     */
    const timePatterns = [
      /\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i,
      /\b\d{1,2}\s*(?:am|pm)\b/i,
      /\b\d{1,2}:\d{2}\b/,
    ];

    let requestedTime = null;

    for (const pattern of timePatterns) {
      const match = text.match(pattern);

      if (match) {
        requestedTime = parseTimeToMinutes(match[0]);
        break;
      }
    }

    if (requestedTime === null) {
      return null;
    }

    /*
     * If doctor was specified, only search that doctor.
     */
    const candidateSlots = doctorMatch
      ? availableSlots.filter(
          (slot) =>
            slot.doctorName &&
            slot.doctorName
              .toLowerCase()
              .replace(/[.,]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .includes(
                doctorMatch.doctorName
                  .toLowerCase()
                  .replace(/[.,]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
              )
        )
      : availableSlots;

    /*
     * Match EXACT start time.
     */
    const exactMatch = candidateSlots.find((slot) => {
      const slotTime = parseTimeToMinutes(slot.startTime);

      return slotTime === requestedTime;
    });

    return exactMatch || null;
  };

  const sendMessage = async (
    messageText = input,
    selectedOptionId = null
  ) => {
    const message = messageText.trim();

    if (!message || loading) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * Before clearing options, try to identify whether the
     * user selected an existing slot using natural language.
     *
     * Example:
     * "Dr. Arjun Rao at 9:30 AM"
     */
    let resolvedSlotId = selectedOptionId;

    if (!resolvedSlotId && options.length > 0) {
      const matchedSlot = findSlotFromMessage(message, options);

      if (matchedSlot?.slotId) {
        resolvedSlotId = matchedSlot.slotId;
      }
    }

    setInput('');
    setLoading(true);

    /*
     * Clear old appointment immediately.
     *
     * This fixes the problem where:
     *
     * Appointment confirmed
     * ↓
     * cancel
     * ↓
     * old green confirmation card remains
     */
    setAppointment(null);

    /*
     * Do NOT immediately clear options if the user is
     * selecting a slot by natural language.
     *
     * They will be replaced by the server response anyway.
     */
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        message,
      },
    ]);

    try {
      const response = await apiClient.post('/chat', {
        conversationId,
        message,
        selectedOptionId: resolvedSlotId,
      });

      /*
       * Save conversation ID.
       */
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      /*
       * Add assistant response.
       */
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          message:
            response.message ||
            'I could not generate a response. Please try again.',
        },
      ]);

      /*
       * ALWAYS replace options.
       *
       * If backend returns []:
       * old slots disappear.
       *
       * If backend returns new slots:
       * new slots are displayed.
       */
      setOptions(Array.isArray(response.options) ? response.options : []);

      /*
       * VERY IMPORTANT:
       *
       * Always update appointment state.
       *
       * Before:
       *
       * if (response.appointment) {
       *   setAppointment(response.appointment);
       * }
       *
       * That caused the OLD appointment to remain forever.
       *
       * Now:
       *
       * response.appointment exists -> show it
       * response.appointment is null/undefined -> remove it
       */
      setAppointment(response.appointment || null);
    } catch (error) {
      console.error('Chat error:', error);

      /*
       * Do not leave stale appointment visible after an error.
       */
      setAppointment(null);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          message:
            error?.response?.data?.message ||
            error?.message ||
            'Something went wrong. Please try again.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!input.trim() || loading) {
      return;
    }

    sendMessage();
  };

  /*
   * Called when the user clicks an appointment card.
   */
  const handleSlotSelect = (slot) => {
    if (!slot?.slotId || loading) {
      return;
    }

    const label = `${slot.doctorName || 'Doctor'} — ${formatDate(
      slot.date
    )} at ${formatTime(slot.startTime)}`;

    sendMessage(
      `I would like to select this appointment: ${label}`,
      slot.slotId
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return '';
    }

    /*
     * Prevent timezone shifting.
     */
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (time) => {
    if (!time) {
      return '';
    }

    const [hours, minutes] = time.split(':');

    const date = new Date();

    date.setHours(
      Number(hours),
      Number(minutes),
      0,
      0
    );

    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-page">

      {/* HEADER */}
      <header className="chat-header">
        <div className="brand">
          <div className="brand-icon">✚</div>

          <div>
            <h1>AppointAI</h1>
            <span>AI Appointment Assistant</span>
          </div>
        </div>

        <div className="header-right">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div>
              <strong>{user?.name}</strong>
              <span>Patient</span>
            </div>
          </div>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="chat-container">

        <section className="chat-card">

          {/* CHAT TITLE */}
          <div className="chat-title">
            <div>
              <h2>Book an Appointment</h2>

              <p>
                Describe what you need in natural language.
                I'll handle the rest.
              </p>
            </div>

            <div className="online-status">
              <span></span>
              AI Online
            </div>
          </div>

          {/* MESSAGES */}
          <div className="messages-area">

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-row ${
                  msg.role === 'user'
                    ? 'user-row'
                    : 'assistant-row'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="message-avatar">
                    AI
                  </div>
                )}

                <div
                  className={`message-bubble ${
                    msg.role === 'user'
                      ? 'user-message'
                      : 'assistant-message'
                  } ${
                    msg.error
                      ? 'error-message'
                      : ''
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}

            {/* AVAILABLE SLOTS */}
            {options.length > 0 && (
              <div className="options-wrapper">

                <div className="options-title">
                  Available appointments
                </div>

                <div className="slot-grid">

                  {options.map((slot, index) => (
                    <button
                      key={slot.slotId || index}
                      className="slot-card"
                      onClick={() =>
                        handleSlotSelect(slot)
                      }
                      disabled={loading}
                      type="button"
                    >
                      <div className="slot-icon">
                        🩺
                      </div>

                      <div className="slot-info">

                        <strong>
                          {slot.doctorName ||
                            'Available Doctor'}
                        </strong>

                        {slot.specializationName && (
                          <span>
                            {slot.specializationName}
                          </span>
                        )}

                        <span>
                          📅 {formatDate(slot.date)}
                        </span>

                        <span>
                          🕐 {formatTime(slot.startTime)}

                          {slot.endTime &&
                            ` - ${formatTime(
                              slot.endTime
                            )}`}
                        </span>

                        {slot.location && (
                          <span>
                            📍 {slot.location}
                          </span>
                        )}

                      </div>

                      <span className="select-arrow">
                        →
                      </span>
                    </button>
                  ))}

                </div>
              </div>
            )}

            {/* BOOKING CONFIRMATION */}
            {appointment && (
              <div className="booking-success">

                <div className="success-icon">
                  ✓
                </div>

                <div>
                  <h3>
                    Appointment Confirmed!
                  </h3>

                  <p>
                    Your appointment has been
                    successfully booked.
                  </p>

                  {appointment.bookingId && (
                    <div className="booking-id">
                      Booking ID:{' '}
                      <strong>
                        {appointment.bookingId}
                      </strong>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* LOADING */}
            {loading && (
              <div className="message-row assistant-row">

                <div className="message-avatar">
                  AI
                </div>

                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>
            )}

            <div ref={messagesEndRef} />

          </div>

          {/* INPUT */}
          <form
            className="chat-input-area"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              placeholder="e.g. I need a dermatologist tomorrow at 5 PM"
              disabled={loading}
            />

            <button
              type="submit"
              className="send-btn"
              disabled={
                loading || !input.trim()
              }
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>

          <div className="chat-hint">
            <span>💡</span>
            Try: "I need a cardiologist tomorrow afternoon"
          </div>

        </section>

        {/* SIDEBAR */}
        <aside className="chat-sidebar">

          <div className="info-card">

            <div className="info-icon">
              🤖
            </div>

            <h3>
              How AppointAI works
            </h3>

            <div className="step">
              <span>1</span>

              <div>
                <strong>
                  Tell us what you need
                </strong>

                <p>
                  Use normal conversational language.
                </p>
              </div>
            </div>

            <div className="step">
              <span>2</span>

              <div>
                <strong>
                  Choose a slot
                </strong>

                <p>
                  I'll find matching doctors and times.
                </p>
              </div>
            </div>

            <div className="step">
              <span>3</span>

              <div>
                <strong>
                  Confirm your booking
                </strong>

                <p>
                  Your appointment is saved securely.
                </p>
              </div>
            </div>

          </div>

          <div className="info-card quick-card">

            <h3>
              Quick examples
            </h3>

            <button
              type="button"
              onClick={() =>
                sendMessage(
                  'I need to see a dermatologist tomorrow'
                )
              }
              disabled={loading}
            >
              🧴 Dermatologist
            </button>

            <button
              type="button"
              onClick={() =>
                sendMessage(
                  'I need a cardiologist this week'
                )
              }
              disabled={loading}
            >
              ❤️ Cardiologist
            </button>

            <button
              type="button"
              onClick={() =>
                sendMessage(
                  'Show me available doctors'
                )
              }
              disabled={loading}
            >
              👨‍⚕️ Available doctors
            </button>

          </div>

        </aside>

      </main>
    </div>
  );
}

export default ChatPage;