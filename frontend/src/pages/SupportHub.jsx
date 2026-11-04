import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquareText,
  Send,
  Image,
  CheckCheck,
  ShieldCheck,
  Wrench,
  AlertCircle,
  Clock,
  CheckCircle2,
  Plus,
  Loader2,
  Radio,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function SupportHub() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('CHAT'); // CHAT | TICKETS
  const [selectedContact, setSelectedContact] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // New Ticket Form States
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');

  // Fetch contacts for chat
  const { data: contacts = [] } = useQuery({
    queryKey: ['chatContacts'],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/contacts/');
      return res.data;
    },
  });

  // Fetch complaint tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ['complaintTickets'],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/complaints/');
      return res.data;
    },
  });

  // Auto-select first contact if none selected
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts, selectedContact]);

  // Fetch message history when selected contact changes
  useEffect(() => {
    if (!selectedContact || !user) return;
    
    axiosClient.get(`/communication/messages/${selectedContact.id}/`).then((res) => {
      setChatMessages(res.data);
    });

    // Establish WebSocket connection for instant chat
    const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws';
    const wsUrl = `${wsBase}/chat/${user.id}/${selectedContact.id}/`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setChatMessages((prev) => [...prev, data]);
    };

    return () => {
      ws.close();
    };
  }, [selectedContact, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedContact || !user) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          sender_id: user.id,
          receiver_id: selectedContact.id,
          message: messageText.trim(),
        })
      );
      setMessageText('');
    } else {
      // Fallback to REST API if socket is reconnecting
      axiosClient
        .post(`/communication/messages/${selectedContact.id}/`, { message: messageText })
        .then((res) => {
          setChatMessages((prev) => [...prev, res.data]);
          setMessageText('');
        });
    }
  };

  // Ticket creation mutation
  const ticketMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/communication/complaints/', formData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintTickets'] });
      setShowNewTicketModal(false);
      setTicketTitle('');
      setTicketDescription('');
    },
  });

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    await axiosClient.patch(`/communication/complaints/${ticketId}/`, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['complaintTickets'] });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* TOP HEADER WITH TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">Support & Real-Time Hub</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              <Radio className="w-3 h-3 animate-pulse text-emerald-500" /> LIVE SYNC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time WebSocket chat and maintenance ticket stream.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('CHAT')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'CHAT' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Live Chat
            </button>
            <button
              onClick={() => setActiveTab('TICKETS')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'TICKETS' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Complaint Tickets ({tickets.filter((t) => t.status !== 'RESOLVED').length})
            </button>
          </div>

          <button
            onClick={() => setShowNewTicketModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* TAB 1: REAL-TIME CHAT INTERFACE */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[600px]">
          {/* Left Contacts Sidebar */}
          <div className="lg:col-span-4 border-r border-slate-200/80 flex flex-col">
            <div className="p-4 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isAdmin ? 'All House Residents' : 'Landlord / Admin Support'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {contacts.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className={`p-4 flex items-center gap-3 cursor-pointer transition ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    {c.profile_picture_url ? (
                      <img src={c.profile_picture_url} alt={c.full_name} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                        {c.full_name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{c.full_name}</h4>
                        {c.unread_count > 0 && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-indigo-600 truncate">{c.room_badge}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.last_message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Active Chat Pane */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-slate-50/50">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                      {selectedContact.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{selectedContact.full_name}</h3>
                      <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {selectedContact.room_badge} • Active Now
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {chatMessages.map((msg, idx) => {
                    const isMe = msg.sender === user.id || msg.sender_name === user.full_name;
                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-3 text-xs shadow-2xs ${
                            isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                          }`}
                        >
                          <p className="leading-relaxed">{msg.message}</p>
                          {msg.attachment_url && (
                            <img src={msg.attachment_url} alt="Attachment" className="mt-2 rounded-xl max-h-48 object-cover" />
                          )}
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Write message to ${selectedContact.full_name}...`}
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Select a contact to start messaging
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COMPLAINT & MAINTENANCE TICKET STREAM */}
      {activeTab === 'TICKETS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tickets.map((t) => {
              const isHigh = t.priority === 'HIGH';
              return (
                <div key={t.id} className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-600">
                        #{t.id} • Room {t.room_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.priority_display}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 mb-1">{t.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{t.description}</p>

                    {t.admin_response && (
                      <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900 mb-4">
                        <strong className="block text-[11px] font-bold text-indigo-700 mb-0.5">Admin Response:</strong>
                        {t.admin_response}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        t.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.status_display}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {t.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleUpdateTicketStatus(t.id, 'RESOLVED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Submit Maintenance Ticket</h3>
            <p className="text-xs text-slate-500 mb-4">
              Report plumbing, wiring, or house cleanliness issues directly to Landlord Admin.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ticketMutation.mutate({
                  title: ticketTitle,
                  description: ticketDescription,
                  priority: ticketPriority,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ISSUE TITLE</label>
                <input
                  type="text"
                  required
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  placeholder="e.g. Bathroom Tap Leakage"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">DETAILED DESCRIPTION</label>
                <textarea
                  required
                  rows={3}
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Describe where and what the problem is..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PRIORITY</label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High Priority (Urgent)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
                >
                  {ticketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}