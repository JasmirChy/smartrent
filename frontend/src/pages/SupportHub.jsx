import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Image as ImageIcon,
  CheckCheck,
  Plus,
  Radio,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function SupportHub() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('CHAT'); // CHAT | COMPLAINTS
  const [selectedContact, setSelectedContact] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [chatImage, setChatImage] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // New Complaint Modal States
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintPriority, setComplaintPriority] = useState('MEDIUM');
  const [complaintAttachment, setComplaintAttachment] = useState(null);

  // Admin Complaint Reply State
  const [replyTexts, setReplyTexts] = useState({});

  const { data: contacts = [] } = useQuery({
    queryKey: ['chatContacts'],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/contacts/');
      return res.data;
    },
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaintTickets'],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/complaints/');
      return res.data;
    },
  });

  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts, selectedContact]);

  useEffect(() => {
    if (!selectedContact || !user) return;

    axiosClient.get(`/communication/messages/${selectedContact.id}/`).then((res) => {
      setChatMessages(res.data);
      queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    });

    const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws';
    const wsUrl = `${wsBase}/chat/${user.id}/${selectedContact.id}/`;

    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setChatMessages((prev) => [...prev, data]);
      queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    };

    return () => ws.close();
  }, [selectedContact, user, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!messageText.trim() && !chatImage) || !selectedContact || !user) return;

    if (chatImage) {
      setSendingMsg(true);
      try {
        const formData = new FormData();
        formData.append('message', messageText.trim());
        formData.append('attachment', chatImage);
        const res = await axiosClient.post(
          `/communication/messages/${selectedContact.id}/`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setChatMessages((prev) => [...prev, res.data]);
        setMessageText('');
        setChatImage(null);
        queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
      } finally {
        setSendingMsg(false);
      }
      return;
    }

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
      const res = await axiosClient.post(`/communication/messages/${selectedContact.id}/`, {
        message: messageText.trim(),
      });
      setChatMessages((prev) => [...prev, res.data]);
      setMessageText('');
    }
  };

  const complaintMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/communication/complaints/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintTickets'] });
      setShowNewComplaintModal(false);
      setComplaintTitle('');
      setComplaintDescription('');
      setComplaintAttachment(null);
      setActiveTab('COMPLAINTS');
    },
  });

  const handleAdminUpdateComplaint = async (complaintId, status, adminResponse) => {
    await axiosClient.patch(`/communication/complaints/${complaintId}/`, {
      status,
      admin_response: adminResponse,
    });
    queryClient.invalidateQueries({ queryKey: ['complaintTickets'] });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">Chat & Complaints Hub</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              <Radio className="w-3 h-3 animate-pulse text-emerald-500" /> LIVE SYNC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct real-time chat with Admin and room/house complaint reporting.
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
              onClick={() => setActiveTab('COMPLAINTS')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'COMPLAINTS' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Complaints ({complaints.filter((c) => c.status !== 'RESOLVED').length})
            </button>
          </div>

          <button
            onClick={() => setShowNewComplaintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Report a Complaint
          </button>
        </div>
      </div>

      {/* TAB 1: REAL-TIME CHAT */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[580px]">
          {/* Contacts List */}
          <div className="lg:col-span-4 border-r border-slate-200/80 flex flex-col">
            <div className="p-4 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {isAdmin ? 'Tenants & Rooms' : 'Landlord / Admin Desk'}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {contacts.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className={`p-4 flex items-center gap-3 cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                      {c.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{c.full_name}</h4>
                        {c.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-indigo-600">{c.room_badge}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.last_message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Conversation */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-slate-50/50">
            {selectedContact ? (
              <>
                <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedContact.full_name}</h3>
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      {selectedContact.room_badge} • {selectedContact.phone_number}
                    </p>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[420px]">
                  {chatMessages.map((msg, idx) => {
                    const isMe = msg.sender === user.id || msg.sender_name === user.full_name;
                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                          }`}
                        >
                          {msg.message && <p className="leading-relaxed">{msg.message}</p>}
                          {msg.attachment_url && (
                            <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                              <img
                                src={msg.attachment_url}
                                alt="Chat attachment"
                                className="mt-2 rounded-xl max-h-48 object-cover border border-white/20"
                              />
                            </a>
                          )}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isMe ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input + Photo Attachment */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-white border-t border-slate-200/80 space-y-2"
                >
                  {chatImage && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                      <span className="truncate">Attached: {chatImage.name}</span>
                      <button type="button" onClick={() => setChatImage(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition">
                      <ImageIcon className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setChatImage(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Message ${selectedContact.full_name}...`}
                      className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-600"
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition"
                    >
                      {sendingMsg ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Select a contact to start chatting
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TENANT COMPLAINTS & ISSUE REPORTS */}
      {activeTab === 'COMPLAINTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {complaints.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-10 text-center border border-slate-200/80 text-xs text-slate-400">
              No complaints reported yet. Click "Report a Complaint" if you have any room or utility issue.
            </div>
          ) : (
            complaints.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-indigo-600">
                      Complaint #{c.id} • Room {c.room_number} ({c.tenant_name})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.priority_display}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">{c.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>

                  {c.attachment_url && (
                    <a href={c.attachment_url} target="_blank" rel="noreferrer">
                      <img
                        src={c.attachment_url}
                        alt="Complaint Proof"
                        className="w-full h-32 object-cover rounded-xl border border-slate-200 mb-3"
                      />
                    </a>
                  )}

                  {c.admin_response && (
                    <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900">
                      <strong className="block text-[10px] uppercase text-indigo-700 mb-0.5">
                        Admin Official Action:
                      </strong>
                      {c.admin_response}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={replyTexts[c.id] ?? c.admin_response ?? ''}
                        onChange={(e) =>
                          setReplyTexts({ ...replyTexts, [c.id]: e.target.value })
                        }
                        placeholder="Write admin response..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-indigo-600"
                      />
                      <button
                        onClick={() =>
                          handleAdminUpdateComplaint(
                            c.id,
                            'IN_PROGRESS',
                            replyTexts[c.id] ?? c.admin_response
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold"
                      >
                        Reply
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        c.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'IN_PROGRESS'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.status_display}
                    </span>

                    {isAdmin && c.status !== 'RESOLVED' && (
                      <button
                        onClick={() =>
                          handleAdminUpdateComplaint(
                            c.id,
                            'RESOLVED',
                            replyTexts[c.id] || c.admin_response || 'Complaint resolved by Admin.'
                          )
                        }
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition"
                      >
                        ✓ Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REPORT A COMPLAINT MODAL */}
      {showNewComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" /> Report a Complaint
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Report plumbing, electrical, sub-meter, or house cleanliness complaints directly to Admin.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData();
                fd.append('title', complaintTitle);
                fd.append('description', complaintDescription);
                fd.append('priority', complaintPriority);
                if (complaintAttachment) fd.append('attachment', complaintAttachment);
                complaintMutation.mutate(fd);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  COMPLAINT SUBJECT
                </label>
                <input
                  type="text"
                  required
                  value={complaintTitle}
                  onChange={(e) => setComplaintTitle(e.target.value)}
                  placeholder="e.g. Bathroom tap leaking / Corridor light issue"
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  COMPLAINT DETAILS
                </label>
                <textarea
                  required
                  rows={3}
                  value={complaintDescription}
                  onChange={(e) => setComplaintDescription(e.target.value)}
                  placeholder="Describe the problem clearly so Admin can fix it..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URGENCY</label>
                <select
                  value={complaintPriority}
                  onChange={(e) => setComplaintPriority(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="LOW">Normal / Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">Urgent / High Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ATTACH PHOTO PROOF (OPTIONAL)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setComplaintAttachment(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewComplaintModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={complaintMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md"
                >
                  {complaintMutation.isPending ? 'Submitting...' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}