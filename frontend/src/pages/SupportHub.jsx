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
  Search,
  ArrowLeft,
  Phone,
  MessageSquare,
  Wrench,
  Sparkles,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';
import axiosClient, { deleteEntireChat } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function SupportHub() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('CHAT'); // CHAT | COMPLAINTS
  const [selectedContact, setSelectedContact] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const [messageText, setMessageText] = useState('');
  const [chatImage, setChatImage] = useState(null);
  const [chatImagePreview, setChatImagePreview] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Lightbox for viewing chat/complaint images full-screen
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // New Complaint Modal States
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintPriority, setComplaintPriority] = useState('MEDIUM');
  const [complaintAttachment, setComplaintAttachment] = useState(null);
  const [complaintPreview, setComplaintPreview] = useState(null);
  const [complaintFilter, setComplaintFilter] = useState('ALL'); // ALL | OPEN | RESOLVED

  // Admin Complaint Reply State
  const [replyTexts, setReplyTexts] = useState({});

  const { data: rawContacts = [] } = useQuery({
    queryKey: ['chatContacts', user?.id, isAdmin],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/contacts/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    refetchInterval: 5000,
  });

  const { data: rawComplaints = [] } = useQuery({
    queryKey: ['complaintTickets'],
    queryFn: async () => {
      const res = await axiosClient.get('/communication/complaints/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const allFetchedContacts = Array.isArray(rawContacts) ? rawContacts : [];

  // STRICT FRONTEND GUARD:
  // If user is a Tenant (!isAdmin), ONLY show the Landlord/Admin contact. Never show other tenants!
  const contacts = isAdmin
    ? allFetchedContacts.filter((c) => c.role !== 'ADMIN')
    : allFetchedContacts.filter(
        (c) => c.role === 'ADMIN' || c.room_badge === 'Landlord / Admin'
      );

  const complaints = Array.isArray(rawComplaints) ? rawComplaints : [];

  // Auto-select the first valid contact (for Tenant, this immediately selects Landlord Admin)
  useEffect(() => {
    if (contacts.length > 0) {
      const stillValid = contacts.some((c) => c.id === selectedContact?.id);
      if (!selectedContact || !stillValid) {
        setSelectedContact(contacts[0]);
      }
    } else {
      setSelectedContact(null);
    }
  }, [contacts, selectedContact]);

  useEffect(() => {
    if (!selectedContact || !user) return;

    axiosClient.get(`/communication/messages/${selectedContact.id}/`).then((res) => {
      const msgs = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setChatMessages(msgs);
      queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    });

    const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws';
    const wsUrl = `${wsBase}/chat/${user.id}/${selectedContact.id}/`;

    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setChatMessages((prev) => [...prev, data]);
      queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    };

    return () => {
      setWsConnected(false);
      ws.close();
    };
  }, [selectedContact, user, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSelectImage = (file) => {
    if (!file) return;
    setChatImage(file);
    setChatImagePreview(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    setChatImage(null);
    setChatImagePreview(null);
  };

  const deleteChatMutation = useMutation({
    mutationFn: (userId) => deleteEntireChat(userId),
    onSuccess: (data) => {
      setChatMessages([]);
      setBannerMsg({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    },
  });

  const handleSendMessage = async (e) => {
    e?.preventDefault();
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
        clearSelectedImage();
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
      setSendingMsg(true);
      try {
        const res = await axiosClient.post(`/communication/messages/${selectedContact.id}/`, {
          message: messageText.trim(),
        });
        setChatMessages((prev) => [...prev, res.data]);
        setMessageText('');
        queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
      } finally {
        setSendingMsg(false);
      }
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
      setComplaintPreview(null);
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

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.room_badge || '').toLowerCase().includes(q) ||
      (c.phone_number || '').toLowerCase().includes(q)
    );
  });

  const filteredComplaints = complaints.filter((c) => {
    if (complaintFilter === 'OPEN') return c.status !== 'RESOLVED';
    if (complaintFilter === 'RESOLVED') return c.status === 'RESOLVED';
    return true;
  });

  const formatDateBadge = (dateStr) => {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalUnreadMessages = contacts.reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0);
  const openComplaintsCount = complaints.filter((c) => c.status !== 'RESOLVED').length;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 space-y-5">
      {/* TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                SmartRent Messenger & Support
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  wsConnected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                <Radio
                  className={`w-3 h-3 ${
                    wsConnected ? 'text-emerald-500 animate-pulse' : 'text-indigo-500'
                  }`}
                />
                {wsConnected ? 'REALTIME WS' : 'INSTANT SYNC'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? 'Direct tenant messaging, photo proofs, and maintenance ticket resolution.'
                : 'Chat directly with your Landlord Admin or report room maintenance issues.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('CHAT')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'CHAT'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Messenger
              {totalUnreadMessages > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                  {totalUnreadMessages}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('COMPLAINTS')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'COMPLAINTS'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Tickets ({openComplaintsCount})
            </button>
          </div>

          <button
            onClick={() => setShowNewComplaintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md shadow-rose-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Report Issue
          </button>
        </div>
      </div>

      {bannerMsg.text && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex justify-between items-center">
          <span>{bannerMsg.text}</span>
          <button onClick={() => setBannerMsg({ type: '', text: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: WHATSAPP / MESSENGER STYLE REAL-TIME CHAT */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden h-[72vh] min-h-[540px] max-h-[760px]">
          {/* LEFT SIDEBAR: CONTACTS LIST */}
          <div
            className={`lg:col-span-4 border-r border-slate-200/80 flex flex-col bg-white h-full ${
              mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {isAdmin ? `Tenants Directory (${contacts.length})` : 'Landlord Support Desk'}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Online
                </span>
              </div>

              {/* Search bar only needed for Admin managing multiple tenants */}
              {isAdmin && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search tenant name, room, or phone..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-2xl bg-slate-100/80 border border-transparent focus:bg-white focus:border-indigo-500 outline-none transition"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {isAdmin
                    ? `No tenants matching "${contactSearch}"`
                    : 'Landlord Admin support channel is ready.'}
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const isSelected = selectedContact?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedContact(c);
                        setMobileShowChat(true);
                      }}
                      className={`p-3.5 sm:p-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/90 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {c.profile_picture_url ? (
                          <img
                            src={c.profile_picture_url}
                            alt={c.full_name}
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold flex items-center justify-center text-base shadow-xs">
                            {c.full_name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">
                            {c.full_name || 'Landlord Admin'}
                          </h4>
                          {c.last_message_time && (
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                              {new Date(c.last_message_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-700 text-[10px] font-extrabold">
                            {c.room_badge}
                          </span>
                          {c.unread_count > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold shadow-xs">
                              {c.unread_count} new
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-xs mt-1 truncate ${
                            c.unread_count > 0
                              ? 'font-extrabold text-slate-900'
                              : 'text-slate-500'
                          }`}
                        >
                          {c.last_message || 'Tap to start chatting...'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: ACTIVE WHATSAPP / MESSENGER CONVERSATION */}
          <div
            className={`lg:col-span-8 flex flex-col justify-between h-full bg-[#F8FAFC] ${
              !mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {selectedContact ? (
              <>
                {/* Conversation Top Header with Clear Chat / Delete History Option */}
                <div className="px-4 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-2xs z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileShowChat(false)}
                      className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-700"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative shrink-0">
                      {selectedContact.profile_picture_url ? (
                        <img
                          src={selectedContact.profile_picture_url}
                          alt={selectedContact.full_name}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-extrabold flex items-center justify-center text-sm">
                          {selectedContact.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">
                        {selectedContact.full_name || 'Landlord Admin'}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-indigo-600">
                          {selectedContact.room_badge}
                        </span>
                        {selectedContact.phone_number && (
                          <>
                            <span>•</span>
                            <span className="truncate">{selectedContact.phone_number}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete the entire chat history with ${selectedContact.full_name}?`
                            )
                          ) {
                            deleteChatMutation.mutate(selectedContact.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition flex items-center gap-1.5"
                        title="Delete Entire Chat History"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline text-[11px]">Clear Chat</span>
                      </button>
                    )}

                    {selectedContact.phone_number && (
                      <a
                        href={`tel:${selectedContact.phone_number}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold transition"
                        title="Call directly"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Call</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Chat Messages Scroll Container */}
                <div
                  className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3"
                  style={{
                    backgroundImage:
                      'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-extrabold text-slate-800">
                        No messages with {selectedContact.full_name || 'Landlord Admin'} yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs mt-1">
                        Send a message or attach a photo below to start a real-time conversation.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const isMe =
                        msg.sender === user?.id || msg.sender_name === user?.full_name;
                      const currentDateBadge = formatDateBadge(msg.created_at);
                      const prevDateBadge =
                        idx > 0 ? formatDateBadge(chatMessages[idx - 1].created_at) : null;
                      const showDateDivider = currentDateBadge !== prevDateBadge;

                      return (
                        <React.Fragment key={msg.id || idx}>
                          {showDateDivider && (
                            <div className="flex justify-center my-3">
                              <span className="px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-[10px] font-extrabold text-slate-500 shadow-2xs">
                                {currentDateBadge}
                              </span>
                            </div>
                          )}

                          <div
                            className={`flex items-end gap-2 ${
                              isMe ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {!isMe && (
                              <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 mb-1">
                                {selectedContact.full_name?.charAt(0)?.toUpperCase() || 'A'}
                              </div>
                            )}

                            <div
                              className={`max-w-[78%] sm:max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-xs transition ${
                                isMe
                                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                              }`}
                            >
                              {msg.attachment_url && (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(msg.attachment_url)}
                                  className="block w-full mb-2 rounded-xl overflow-hidden border border-black/10"
                                >
                                  <img
                                    src={msg.attachment_url}
                                    alt="Attachment"
                                    className="w-full max-h-56 object-cover hover:scale-105 transition-transform"
                                  />
                                </button>
                              )}

                              {msg.message && (
                                <p className="leading-relaxed whitespace-pre-wrap break-words text-[13px]">
                                  {msg.message}
                                </p>
                              )}

                              <div
                                className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                  isMe ? 'text-indigo-200' : 'text-slate-400'
                                }`}
                              >
                                <span>
                                  {msg.created_at
                                    ? new Date(msg.created_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Just now'}
                                </span>
                                {isMe && (
                                  <CheckCheck
                                    className={`w-3.5 h-3.5 ${
                                      msg.is_read ? 'text-emerald-300' : 'text-indigo-200'
                                    }`}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Composer Bar + Live Image Preview */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 bg-white border-t border-slate-200/80 space-y-2.5"
                >
                  {chatImage && (
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-50/90 border border-indigo-200">
                      <div className="flex items-center gap-3 min-w-0">
                        {chatImagePreview && (
                          <img
                            src={chatImagePreview}
                            alt="Preview"
                            className="w-12 h-12 rounded-xl object-cover border border-indigo-300"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-indigo-950 truncate">
                            {chatImage.name}
                          </p>
                          <p className="text-[10px] text-indigo-600">
                            Ready to send photo attachment
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedImage}
                        className="p-1.5 rounded-full bg-white text-slate-600 hover:text-rose-600 shadow-2xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label
                      className="p-3 rounded-2xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 cursor-pointer transition shrink-0"
                      title="Attach Photo"
                    >
                      <ImageIcon className="w-5 h-5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSelectImage(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={`Write a message to ${selectedContact.full_name || 'Landlord Admin'}...`}
                      className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-slate-100/90 border border-transparent focus:bg-white focus:border-indigo-500 outline-none transition"
                    />

                    <button
                      type="submit"
                      disabled={sendingMsg || (!messageText.trim() && !chatImage)}
                      className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-md shadow-indigo-600/20 transition shrink-0"
                    >
                      {sendingMsg ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-8">
                <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
                Select a conversation on the left to start messaging
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TENANT COMPLAINTS & MAINTENANCE TICKETS */}
      {activeTab === 'COMPLAINTS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex bg-white p-1 rounded-2xl border border-slate-200">
              {[
                { key: 'ALL', label: `All Tickets (${complaints.length})` },
                { key: 'OPEN', label: `Open / In Progress (${openComplaintsCount})` },
                {
                  key: 'RESOLVED',
                  label: `Resolved (${complaints.length - openComplaintsCount})`,
                },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setComplaintFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    complaintFilter === f.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredComplaints.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-700">No maintenance tickets found</p>
                <p className="text-xs text-slate-400">
                  Click "Report Issue" above if you need plumbing, electrical, or room assistance.
                </p>
              </div>
            ) : (
              filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[11px] font-extrabold text-indigo-600">
                        Ticket #{c.id} • Room {c.room_number} ({c.tenant_name})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          c.priority === 'HIGH'
                            ? 'bg-rose-100 text-rose-700'
                            : c.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.priority_display}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 mb-1">{c.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>

                    {c.attachment_url && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(c.attachment_url)}
                        className="block w-full mb-3 rounded-2xl overflow-hidden border border-slate-200"
                      >
                        <img
                          src={c.attachment_url}
                          alt="Complaint Proof"
                          className="w-full h-36 object-cover hover:scale-105 transition-transform"
                        />
                      </button>
                    )}

                    {c.admin_response && (
                      <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100 p-3.5 text-xs text-indigo-950">
                        <strong className="block text-[10px] uppercase tracking-wider text-indigo-600 mb-1">
                          Landlord Official Response:
                        </strong>
                        {c.admin_response}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={replyTexts[c.id] ?? c.admin_response ?? ''}
                          onChange={(e) =>
                            setReplyTexts({ ...replyTexts, [c.id]: e.target.value })
                          }
                          placeholder="Write official response..."
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:border-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleAdminUpdateComplaint(
                              c.id,
                              'IN_PROGRESS',
                              replyTexts[c.id] ?? c.admin_response
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold"
                        >
                          Reply
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'IN_PROGRESS'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status === 'RESOLVED' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {c.status_display}
                      </span>

                      {isAdmin && c.status !== 'RESOLVED' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdminUpdateComplaint(
                              c.id,
                              'RESOLVED',
                              replyTexts[c.id] ||
                                c.admin_response ||
                                'Issue resolved by Landlord.'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition"
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
        </div>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

      {showNewComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" /> Report Maintenance Issue
              </h3>
              <button
                onClick={() => setShowNewComplaintModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Report plumbing, electrical, sub-meter, or house cleanliness issues directly to Admin.
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
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  ISSUE SUBJECT
                </label>
                <input
                  type="text"
                  required
                  value={complaintTitle}
                  onChange={(e) => setComplaintTitle(e.target.value)}
                  placeholder="e.g. Bathroom tap leaking / Corridor light issue"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  DETAILED DESCRIPTION
                </label>
                <textarea
                  required
                  rows={3}
                  value={complaintDescription}
                  onChange={(e) => setComplaintDescription(e.target.value)}
                  placeholder="Describe the problem clearly so Admin can resolve it..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  URGENCY LEVEL
                </label>
                <select
                  value={complaintPriority}
                  onChange={(e) => setComplaintPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-600"
                >
                  <option value="LOW">Normal / Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">Urgent / High Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  PHOTO PROOF (OPTIONAL)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setComplaintAttachment(f);
                    setComplaintPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="text-xs text-slate-600"
                />
                {complaintPreview && (
                  <img
                    src={complaintPreview}
                    alt="Preview"
                    className="mt-2 h-24 rounded-xl object-cover border border-slate-200"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewComplaintModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={complaintMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md"
                >
                  {complaintMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}