import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Zap,
  Droplets,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  ImagePlus,
  Building,
  Sparkles,
  Moon,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  BellRing,
  Play,
  Pause,
  ZoomIn,
  Layers,
  Wrench,
  Lock,
  Car,
  Users,
  CreditCard,
  MessageSquare,
  Ban,
  LogOut,
  HeartHandshake,
  FileCheck2,
  Home,
} from 'lucide-react';
import axiosClient, { createReservation, acceptDigitalLease } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDualDate, formatBSOnly } from '../utils/nepaliDate';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85';

const MAX_BANNER_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const HOUSE_RULES_CATEGORIES = [
  {
    id: 1,
    title: '1. Cleanliness & Hygiene',
    titleNe: '१. सरसफाइ र स्वच्छता',
    subtitle: 'Sanitation standards for rooms, kitchens, drains, and shared spaces',
    subtitleNe: 'कोठा, भान्सा, नाली र साझा स्थानहरूको सरसफाइ मापदण्ड',
    icon: Sparkles,
    iconBg: 'bg-emerald-50 text-emerald-600',
    items: [
      'Keep rooms, bathrooms, and shared spaces clean.',
      'Dispose of garbage in designated dustbins.',
      'Clean kitchens and shared facilities after use.',
      'Do not throw waste, sanitary products, or food into drains or toilets.',
      'Maintain cleanliness around the building.',
    ],
    itemsNe: [
      'कोठा, बाथरुम र साझा स्थानहरू सधैं सफा राख्नुहोस्।',
      'फोहोरमैला तोकिएको डस्टबिनमा मात्र फाल्नुहोस्।',
      'भान्सा र साझा सुविधाहरू प्रयोग गरेपछि सफा राख्नुहोस्।',
      'नाली वा शौचालयमा फोहोर, सेनिटरी सामान वा खाना नफाल्नुहोस्।',
      'घर वरिपरिको वातावरण सफा र स्वच्छ राख्नुहोस्।',
    ],
  },
  {
    id: 2,
    title: '2. Property Damage & Maintenance',
    titleNe: '२. सम्पत्ति सुरक्षा र मर्मत सम्भार',
    subtitle: 'Care of walls, fixtures, and reporting of maintenance issues',
    subtitleNe: 'भित्ता, ढोका, फर्निचरको सुरक्षा र मर्मत सम्बन्धी जानकारी',
    icon: Wrench,
    iconBg: 'bg-indigo-50 text-indigo-600',
    items: [
      'Take proper care of walls, doors, furniture, and fixtures.',
      'Do not modify, drill, or repaint property without permission.',
      'Report leaks, breakages, and maintenance issues immediately.',
      'Tenants are responsible for damage caused by negligence or misuse.',
      'Normal wear and tear is not chargeable.',
    ],
    itemsNe: [
      'भित्ता, ढोका, फर्निचर र बत्ती/धाराका सामानहरूको उचित हेरचाह गर्नुहोस्।',
      'अनुमति बिना भित्तामा प्वाल पार्ने, रङ लगाउने वा संरचना परिवर्तन नगर्नुहोस्।',
      'पानी चुहिने, सामान टुटफुट हुने वा मर्मत समस्या भएमा तुरुन्तै जानकारी गराउनुहोस्।',
      'लापरबाही वा गलत प्रयोगले भएको क्षतिको जिम्मेवारी भाडावाल स्वयंको हुनेछ।',
      'सामान्य प्रयोगका क्रममा हुने प्राकृतिक खिइवटमा जरिवाना लाग्ने छैन।',
    ],
  },
  {
    id: 3,
    title: '3. Electricity & Water Usage',
    titleNe: '३. बिजुली र पानीको प्रयोग',
    subtitle: 'Responsible utility consumption and sub-meter integrity',
    subtitleNe: 'बिजुली र पानीको सही सदुपयोग तथा सब-मिटर सुरक्षा',
    icon: Zap,
    iconBg: 'bg-amber-50 text-amber-600',
    items: [
      'Switch off lights and appliances when not in use.',
      'Avoid unnecessary electricity and water wastage.',
      'Use high-power appliances responsibly.',
      'Do not tamper with meters, wiring, or connections.',
      'Pay utility bills within the agreed deadline.',
    ],
    itemsNe: [
      'प्रयोग नभएको बेला बत्ती र विद्युतीय उपकरणहरू बन्द गर्नुहोस्।',
      'बिजुली र पानीको अनावश्यक खेर नफाल्नुहोस्।',
      'उच्च क्षमताका विद्युतीय उपकरणहरू जिम्मेवारीपूर्वक प्रयोग गर्नुहोस्।',
      'सब-मिटर, तार वा जडानमा कुनै पनि छेडछाड नगर्नुहोस्।',
      'तोकिएको समयसीमा भित्र बिजुली र पानीको बिल भुक्तानी गर्नुहोस्।',
    ],
  },
  {
    id: 4,
    title: '4. Noise & Peaceful Environment',
    titleNe: '४. शान्त र मर्यादित वातावरण',
    subtitle: 'Quiet hours (10:00 PM – 6:00 AM) and neighborly conduct',
    subtitleNe: 'राति १०:०० देखि बिहान ६:०० सम्म शान्त समय र शिष्ट व्यवहार',
    icon: Moon,
    iconBg: 'bg-violet-50 text-violet-600',
    items: [
      'Avoid loud music, shouting, and unnecessary disturbances.',
      'Maintain quiet hours from 10:00 PM to 6:00 AM.',
      'Respect neighbors and other tenants.',
      'Fighting, threatening, or disruptive behavior is prohibited.',
    ],
    itemsNe: [
      'चर्को स्वरमा गीत बजाउने, कराउने र अनावश्यक होहल्ला नगर्नुहोस्।',
      'राति १०:०० बजेदेखि बिहान ६:०० बजेसम्म पूर्ण शान्त वातावरण कायम राख्नुहोस्।',
      'छिमेकी र अन्य भाडावालहरूलाई सम्मान गर्नुहोस्।',
      'झगडा गर्ने, धम्की दिने वा अशान्ति फैलाउने कार्य पूर्णतः निषेधित छ।',
    ],
  },
  {
    id: 5,
    title: '5. Security & Safety',
    titleNe: '५. सुरक्षा र सावधानी',
    subtitle: 'Access control, appliance safety, and emergency awareness',
    subtitleNe: 'ढोका/ताला सुरक्षा, खाना पकाउँदा सावधानी र आपतकालीन सतर्कता',
    icon: Lock,
    iconBg: 'bg-teal-50 text-teal-600',
    items: [
      'Lock rooms and entrances when leaving.',
      'Do not share keys or access codes with unauthorized people.',
      'Inform the owner about overnight guests.',
      'Never leave cooking appliances unattended.',
      'Do not keep hazardous or illegal materials on the property.',
      'Report suspicious activities and emergencies immediately.',
    ],
    itemsNe: [
      'बाहिर जाँदा कोठा र मूल गेटमा राम्ररी ताला लगाउनुहोस्।',
      'अपरिचित वा अनधिकृत व्यक्तिलाई साँचो वा प्रवेश कोड नदिनुहोस्।',
      'रातभरि बस्ने पाहुना आउँदा घरधनीलाई जानकारी गराउनुहोस्।',
      'खाना पकाउने ग्यास वा हिटर बालेर कोठा छोडेर नहिँड्नुहोस्।',
      'घरमा कुनै पनि जोखिमपूर्ण वा गैरकानुनी वस्तुहरू नराख्नुहोस्।',
      'शंकास्पद गतिविधि वा आपतकालीन अवस्था देखिएमा तुरुन्त खबर गर्नुहोस्।',
    ],
  },
  {
    id: 6,
    title: '6. Parking & Common Areas',
    titleNe: '६. पार्किङ र साझा क्षेत्रहरू',
    subtitle: 'Designated parking and unobstructed corridors & staircases',
    subtitleNe: 'तोकिएको स्थानमा पार्किङ र प्यासेज/भर्याङ खुला राख्ने नियम',
    icon: Car,
    iconBg: 'bg-sky-50 text-sky-600',
    items: [
      'Park vehicles only in designated spaces.',
      'Keep corridors, staircases, and balconies clean.',
      'Do not block entrances or other vehicles.',
      'Do not misuse or damage shared facilities.',
      'Keep common areas accessible to everyone.',
    ],
    itemsNe: [
      'सवारी साधन तोकिएको पार्किङ स्थानमा मात्र राख्नुहोस्।',
      'प्यासेज, भर्याङ र बाल्कोनी सधैं सफा राख्नुहोस्।',
      'मूल ढोका वा अन्य सवारी साधन छेकिएर पार्किङ नगर्नुहोस्।',
      'साझा सुविधाहरूको दुरुपयोग वा नोक्सानी नगर्नुहोस्।',
      'साझा क्षेत्रहरू सबैका लागि सहज र खुला राख्नुहोस्।',
    ],
  },
  {
    id: 7,
    title: '7. Visitors & Guests',
    titleNe: '७. पाहुना र आगन्तुकहरू',
    subtitle: 'Guest conduct and prior notice for overnight stays',
    subtitleNe: 'पाहुनाको मर्यादित व्यवहार र राति बस्ने पाहुनाको जानकारी',
    icon: Users,
    iconBg: 'bg-indigo-50 text-indigo-600',
    items: [
      "Tenants are responsible for their visitors' behavior.",
      'Inform the owner about overnight or extended stays.',
      'Ensure guests respect other residents and house rules.',
      'Visitors must not damage property or disturb others.',
    ],
    itemsNe: [
      'आफ्ना पाहुनाहरूको व्यवहारप्रति भाडावाल स्वयं जिम्मेवार हुनेछन्।',
      'पाहुना रातभरि वा लामो समय बस्ने भएमा घरधनीलाई जानकारी गराउनुहोस्।',
      'पाहुनाहरूले अन्य भाडावाल र घरको नियमको पालना गरेको सुनिश्चित गर्नुहोस्।',
      'पाहुनाहरूबाट घरको सम्पत्तिमा क्षति वा अन्यलाई डिस्टर्ब हुनु हुँदैन।',
    ],
  },
  {
    id: 8,
    title: '8. Rent & Bill Payments',
    titleNe: '८. कोठा भाडा र बिल भुक्तानी',
    subtitle: 'Timely monthly settlement and receipt record-keeping',
    subtitleNe: 'समयमै मासिक भाडा तथा बिल भुक्तानी र रसिद सुरक्षित राख्ने',
    icon: CreditCard,
    iconBg: 'bg-emerald-50 text-emerald-600',
    items: [
      'Pay monthly rent and utility bills on time.',
      'Clear outstanding payments within the agreed period.',
      'Inform the owner about possible payment delays.',
      'Keep payment receipts for future reference.',
      'Follow agreed rent and billing arrangements.',
    ],
    itemsNe: [
      'मासिक कोठा भाडा र बिजुली/पानीको बिल समयमै भुक्तानी गर्नुहोस्।',
      'बाँकी बक्यौता तोकिएको समयसीमा भित्रै चुक्ता गर्नुहोस्।',
      'भुक्तानीमा केहि ढिलाइ हुने अवस्था आएमा समयमै घरधनीलाई जानकारी दिनुहोस्।',
      'भुक्तानी गरेका रसिदहरू भविष्यको प्रयोजनका लागि सुरक्षित राख्नुहोस्।',
      'सहमति अनुसारको भाडा र बिलिङ नियम पालना गर्नुहोस्।',
    ],
  },
  {
    id: 9,
    title: '9. Maintenance & Communication',
    titleNe: '९. मर्मत सम्भार र संवाद',
    subtitle: 'Official reporting channels and inspection cooperation',
    subtitleNe: 'वेबसाइट वा घरधनीमार्फत समस्या टिपाउने र निरीक्षणमा सहयोग',
    icon: MessageSquare,
    iconBg: 'bg-blue-50 text-blue-600',
    items: [
      'Report maintenance problems and damages promptly.',
      'Obtain permission before making repairs or modifications.',
      'Cooperate with scheduled inspections after prior notice.',
      'Report complaints through the website or directly to the owner.',
      'Allow necessary access during emergencies.',
    ],
    itemsNe: [
      'मर्मत सम्भारका समस्या र टुटफुट तुरुन्तै जानकारी गराउनुहोस्।',
      'कुनै मर्मत वा परिवर्तन गर्नुअघि घरधनीको अनुमति लिनुहोस्।',
      'पूर्व जानकारी गराई गरिने कोठा निरीक्षणमा सहयोग गर्नुहोस्।',
      'गुनासो वा समस्या स्मार्टरेन्ट वेबसाइट वा सिधै घरधनीलाई टिपाउनुहोस्।',
      'आपतकालीन अवस्थामा आवश्यक जाँचका लागि प्रवेश सहज बनाउनुहोस्।',
    ],
  },
  {
    id: 10,
    title: '10. Additional Restrictions',
    titleNe: '१०. थप प्रतिबन्धहरू',
    subtitle: 'Policies on pets, subletting, commercial use, and privacy',
    subtitleNe: 'घरपालुवा जनावर, सब-लेटिङ, व्यापारिक प्रयोग र गोपनीयता',
    icon: Ban,
    iconBg: 'bg-rose-50 text-rose-600',
    items: [
      'Illegal activities are strictly prohibited.',
      'Pets require prior owner approval.',
      'Subletting requires written permission.',
      'Unauthorized commercial activities are not allowed.',
      "Respect everyone's privacy and personal belongings.",
    ],
    itemsNe: [
      'गैरकानुनी गतिविधिहरू पूर्ण रूपमा निषेधित छन्।',
      'घरपालुवा जनावर राख्न घरधनीको पूर्व अनुमति अनिवार्य छ।',
      'लिखित अनुमति बिना कोठा अरुलाई भाडामा (Sublet) दिन पाइने छैन।',
      'अनधिकृत व्यापारिक गतिविधि सञ्चालन गर्न पाइने छैन।',
      'सबैको व्यक्तिगत गोपनीयता र सामानको सम्मान गर्नुहोस्।',
    ],
  },
  {
    id: 11,
    title: '11. Damage Fines & Penalties',
    titleNe: '११. क्षति जरिवाना र दण्डहरू',
    subtitle: 'Official penalty schedule and transparent fine enforcement rules',
    subtitleNe: 'नियम उल्लंघन वा क्षतिमा लाग्ने आधिकारिक जरिवाना तालिका',
    icon: AlertTriangle,
    iconBg: 'bg-rose-100 text-rose-600',
    isHighlightedFineCategory: true,
    items: [
      'Every fine must include a clear reason.',
      'Photographic evidence should be attached whenever possible.',
      'Tenants receive notifications for issued fines.',
      'Tenants can review and dispute fines.',
      'Repair costs must have supporting evidence.',
      'No fines for normal wear and tear.',
      'All penalties must be reasonable and follow the rental agreement and applicable law.',
    ],
    itemsNe: [
      'प्रत्येक जरिवानामा स्पष्ट कारण उल्लेख गरिएको हुनेछ।',
      'सम्भव भएसम्म फोटो प्रमाण संलग्न गरिनेछ।',
      'जरिवाना जारी हुँदा भाडावालले इमेल र ड्यासबोर्डमा सूचना पाउनेछन्।',
      'भाडावालले जरिवानाको विवरण हेर्न र कुरा राख्न सक्नेछन्।',
      'मर्मत खर्चमा आवश्यक बिल/प्रमाण समावेश हुनेछ।',
      'सामान्य प्राकृतिक खिइवटमा कुनै जरिवाना लाग्ने छैन।',
      'सबै जरिवानाहरू न्यायोचित र भाडा सम्झौता अनुरूप हुनेछन्।',
    ],
  },
  {
    id: 12,
    title: '12. Moving In & Moving Out',
    titleNe: '१२. कोठामा सर्दा र कोठा छोड्दा',
    subtitle: 'Registration, handover inspection, advance notice, and final settlement',
    subtitleNe: 'दर्ता, कोठा बुझबुझारथ, पूर्व सूचना र अन्तिम हिसाब फरफारक',
    icon: LogOut,
    iconBg: 'bg-amber-50 text-amber-600',
    items: [
      'Complete registration before occupying the room.',
      'Inspect and report existing damages during handover.',
      'Provide advance notice before vacating.',
      'Clear outstanding rent and bills before departure.',
      'Return keys and owner-provided belongings.',
      'Complete the final inspection before deposit settlement.',
    ],
    itemsNe: [
      'कोठामा सर्नुअघि अनलाइन दर्ता र केवाईसी (KYC) पूरा गर्नुहोस्।',
      'कोठा बुझ्दा पहिले नै कुनै क्षति भएमा तुरुन्तै जानकारी गराउनुहोस्।',
      'कोठा छोड्नुअघि पूर्व सूचना (Move-Out Request) दिनुहोस्।',
      'कोठा छोड्नुअघि बाँकी भाडा र बिजुली/पानीको बिल चुक्ता गर्नुहोस्।',
      'कोठाको साँचो र घरधनीले उपलब्ध गराएका सामानहरू फिर्ता गर्नुहोस्।',
      'अन्तिम मिटर रिडिङ र निरीक्षण पछि मात्र हिसाब फरफारक गरिनेछ।',
    ],
  },
  {
    id: 13,
    title: '13. General Responsibilities',
    titleNe: '१३. सामान्य जिम्मेवारीहरू',
    subtitle: 'Community harmony, announcements, and agreement compliance',
    subtitleNe: 'आपसी सद्भाव, घरधनीको सूचना पालना र सम्झौताको सम्मान',
    icon: HeartHandshake,
    iconBg: 'bg-teal-50 text-teal-600',
    items: [
      'Respect other tenants, their privacy, and belongings.',
      'Maintain a friendly and cooperative environment.',
      'Follow owner announcements and instructions.',
      'Keep registered contact information updated.',
      'Repeated violations may result in action under the rental agreement.',
    ],
    itemsNe: [
      'अन्य भाडावाल, उनीहरूको गोपनीयता र सामानको सम्मान गर्नुहोस्।',
      'मित्रवत र सहयोगी वातावरण कायम राख्नुहोस्।',
      'घरधनीका आधिकारिक सूचना र निर्देशनहरू पालना गर्नुहोस्।',
      'आफ्नो दर्ता गरिएको मोबाइल नम्बर र विवरण अद्यावधिक राख्नुहोस्।',
      'पटक-पटक नियम उल्लंघन भएमा भाडा सम्झौता अनुसार कारबाही हुन सक्नेछ।',
    ],
  },
];

const DAMAGE_FINE_PENALTIES = [
  {
    violation: 'Littering in shared areas',
    violationNe: 'साझा क्षेत्रमा फोहोर फाल्दा',
    penalty: 'NPR 100–200',
    penaltyNe: 'रु. १००–२००',
  },
  {
    violation: 'Repeated noise disturbances',
    violationNe: 'पटक-पटक होहल्ला वा डिस्टर्ब गर्दा',
    penalty: 'NPR 200–500',
    penaltyNe: 'रु. २००–५००',
  },
  {
    violation: 'Intentional water wastage',
    violationNe: 'जानीजानी पानी खेर फाल्दा',
    penalty: 'Actual additional cost',
    penaltyNe: 'थप वास्तविक लागत',
  },
  {
    violation: 'Damaged furniture or fixtures',
    violationNe: 'फर्निचर वा सामान टुटफुट भएमा',
    penalty: 'Repair/replacement cost',
    penaltyNe: 'मर्मत / प्रतिस्थापन खर्च',
  },
  {
    violation: 'Plumbing or electrical damage',
    violationNe: 'धारा/पाइप वा बिजुलीमा क्षति पुर्याएमा',
    penalty: 'Actual repair cost',
    penaltyNe: 'वास्तविक मर्मत खर्च',
  },
  {
    violation: 'Unauthorized modifications',
    violationNe: 'अनुमति बिना कोठाको संरचना परिवर्तन गरेमा',
    penalty: 'Restoration cost',
    penaltyNe: 'पहिलेकै अवस्थामा फर्काउने खर्च',
  },
  {
    violation: 'Damage caused by guests',
    violationNe: 'पाहुनाबाट भएको क्षति',
    penalty: 'Actual repair cost',
    penaltyNe: 'वास्तविक मर्मत खर्च',
  },
];

const FINE_GUIDELINES_LIST = [
  {
    en: 'Every fine must include a clear reason.',
    ne: 'प्रत्येक जरिवानामा स्पष्ट कारण उल्लेख गरिएको हुनेछ।',
  },
  {
    en: 'Photographic evidence should be attached whenever possible.',
    ne: 'सम्भव भएसम्म फोटो प्रमाण संलग्न गरिनेछ।',
  },
  {
    en: 'Tenants receive notifications for issued fines.',
    ne: 'जरिवाना जारी हुँदा भाडावालले इमेल र ड्यासबोर्डमा सूचना पाउनेछन्।',
  },
  {
    en: 'Tenants can review and dispute fines.',
    ne: 'भाडावालले जरिवानाको विवरण हेर्न र कुरा राख्न सक्नेछन्।',
  },
  {
    en: 'Repair costs must have supporting evidence.',
    ne: 'मर्मत खर्चमा आवश्यक बिल/प्रमाण समावेश हुनेछ।',
  },
  {
    en: 'No fines for normal wear and tear.',
    ne: 'सामान्य प्राकृतिक खिइवटमा कुनै जरिवाना लाग्ने छैन।',
  },
  {
    en: 'All penalties must be reasonable and follow the rental agreement and applicable law.',
    ne: 'सबै जरिवानाहरू न्यायोचित र भाडा सम्झौता अनुरूप हुनेछन्।',
  },
];

function getSafeMediaUrl(rawUrl, cacheBuster = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return rawUrl;

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  let backendOrigin = 'http://localhost:8000';
  try {
    backendOrigin = new URL(apiBase).origin;
  } catch {
    backendOrigin = 'http://localhost:8000';
  }

  let finalUrl = rawUrl.trim();

  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

  if (
    finalUrl.startsWith('http://') &&
    !finalUrl.includes('localhost') &&
    !finalUrl.includes('127.0.0.1') &&
    !finalUrl.includes('192.168.')
  ) {
    finalUrl = 'https://' + finalUrl.substring('http://'.length);
  }

  if (cacheBuster) {
    const sep = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${sep}v=${cacheBuster}`;
  }
  return finalUrl;
}

export default function PublicLanding() {
  const { user, isAdmin, openAuthModal, refreshProfile } = useAuth();
  const { isNepali, t, td } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI Filter & Slideshow States
  const [floorFilter, setFloorFilter] = useState('ALL'); // ALL | GROUND | FIRST
  const [availableOnly, setAvailableOnly] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHoveringHero, setIsHoveringHero] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // 13-Category Accordion & Tenant Acknowledgment States
  const [openRuleIndex, setOpenRuleIndex] = useState(0);
  const [expandAllRules, setExpandAllRules] = useState(false);
  const [rulesAcceptedLocal, setRulesAcceptedLocal] = useState(() => {
    try {
      return localStorage.getItem('smartrent_rules_accepted') === 'true';
    } catch {
      return false;
    }
  });
  const [rulesAckMsg, setRulesAckMsg] = useState('');

  // Reservation Modal States
  const [reservingRoom, setReservingRoom] = useState(null);
  const [requestType, setRequestType] = useState('RESERVE');
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split('T')[0]);
  const [occupantsCount, setOccupantsCount] = useState(1);
  const [phoneNum, setPhoneNum] = useState(user?.phone_number || '');
  const [occupation, setOccupation] = useState('');
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState('500');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [citizenshipDoc, setCitizenshipDoc] = useState(null);
  const [reservationMsg, setReservationMsg] = useState({ type: '', text: '' });

  // Admin Multi-Image Hero Banner Manager States
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('Studio B2 • Balcony Suite');
  const [bannerSubtitle, setBannerSubtitle] = useState(
    'Sub-meter #M-202 • Digital Telemetry Active'
  );
  const [bannerBadge, setBannerBadge] = useState('Physical Inspection Passed');
  const [bannerFiles, setBannerFiles] = useState([]);
  const [bannerPreviews, setBannerPreviews] = useState([]);
  const [bannerFeedback, setBannerFeedback] = useState({ type: '', text: '' });

  // Fetch live Landing Data
  const { data, isLoading } = useQuery({
    queryKey: ['publicLandingData'],
    queryFn: async () => {
      const res = await axiosClient.get('/rooms/landing/');
      return res.data;
    },
    refetchInterval: 4000,
  });

  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  const rawBanners = Array.isArray(data?.banners) ? data.banners : [];
  const notices = Array.isArray(data?.notices) ? data.notices : [];
  const stats = data?.stats || { total_rooms: 9, occupied_rooms: 0, available_rooms: 9 };

  const hasAcceptedRules = Boolean(user?.has_accepted_lease || rulesAcceptedLocal);

  const banners = rawBanners.map((b) => ({
    ...b,
    resolved_url:
      getSafeMediaUrl(b.image_path || b.image_url || b.image) || DEFAULT_HERO_IMAGE,
  }));

  useEffect(() => {
    if (banners.length > 0 && activeSlide >= banners.length) {
      setActiveSlide(0);
    }
  }, [banners.length, activeSlide]);

  useEffect(() => {
    if (!isAutoPlaying || isHoveringHero || showLightbox || banners.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlaying, isHoveringHero, showLightbox, banners.length]);

  useEffect(() => {
    return () => {
      bannerPreviews.forEach((p) => {
        if (p.url && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [bannerPreviews]);

  const acceptRulesMutation = useMutation({
    mutationFn: acceptDigitalLease,
    onSuccess: async (resData) => {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg(
        resData?.message ||
          t(
            'Thank you! Your acknowledgment of the House Rules & Guidelines has been recorded.',
            'धन्यवाद! घरको नियम तथा निर्देशिकामा तपाईंको सहमति सुरक्षित गरियो।'
          )
      );
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['meProfileSettings'] });
    },
    onError: () => {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg(
        t(
          'House Rules & Guidelines acknowledgment saved!',
          'घरको नियम तथा निर्देशिकामा तपाईंको सहमति सुरक्षित गरियो!'
        )
      );
    },
  });

  const handleAcceptHouseRules = () => {
    if (user) {
      acceptRulesMutation.mutate();
    } else {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg(
        t(
          'You have accepted the House Rules & Guidelines! Sign in anytime to link this acknowledgment to your tenant profile.',
          'तपाईंले घरको नियम तथा निर्देशिका स्वीकार गर्नुभएको छ! यसलाई आफ्नो प्रोफाइलमा जोड्न लगइन गर्नुहोस्।'
        )
      );
    }
  };

  const uploadBannerMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/rooms/banners/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      setBannerFiles([]);
      setBannerPreviews([]);
      setActiveSlide(0);
      setBannerFeedback({
        type: 'success',
        text:
          resData?.message ||
          t('Hero slideshow images uploaded successfully!', 'स्लाइडशो फोटोहरू सफलतापूर्वक अपलोड भए!'),
      });
    },
    onError: (err) => {
      setBannerFeedback({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          t(
            'Failed to upload banner image(s). Make sure each image is under 5 MB.',
            'फोटो अपलोड हुन सकेन। प्रत्येक फोटो ५ एमबी भन्दा कम हुनुपर्छ।'
          ),
      });
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      await axiosClient.delete(`/rooms/banners/${bannerId}/`);
    },
    onSuccess: () => {
      setActiveSlide((prev) => Math.max(0, prev - 1));
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      setBannerFeedback({
        type: 'success',
        text: t('Slide removed from hero slideshow.', 'स्लाइडशोबाट फोटो हटाइयो।'),
      });
    },
  });

  const reserveMutation = useMutation({
    mutationFn: async (formData) => {
      return await createReservation(formData);
    },
    onSuccess: () => {
      setReservationMsg({
        type: 'success',
        text: t(
          'Room reservation request submitted successfully! Landlord will review and assign.',
          'कोठा बुकिङ अनुरोध सफलतापूर्वक पठाइयो! घरधनीले जाँच गरी कोठा तोक्नुहुनेछ।'
        ),
      });
      setTimeout(() => {
        setReservingRoom(null);
        setReservationMsg({ type: '', text: '' });
      }, 2500);
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
    },
    onError: (err) => {
      setReservationMsg({
        type: 'error',
        text:
          err.response?.data?.room?.[0] ||
          err.response?.data?.detail ||
          t('Failed to submit reservation.', 'बुकिङ अनुरोध पठाउन सकिएन।'),
      });
    },
  });

  const handleSelectMultipleBannerFiles = (e) => {
    const selectedList = Array.from(e.target.files || []);
    if (selectedList.length === 0) return;

    const validFiles = [];
    const newPreviews = [];

    for (const file of selectedList) {
      if (file.size > MAX_BANNER_SIZE_BYTES) {
        setBannerFeedback({
          type: 'error',
          text: `"${file.name}" exceeds the 5 MB limit (${(file.size / 1024 / 1024).toFixed(
            2
          )} MB).`,
        });
        continue;
      }
      validFiles.push(file);
      newPreviews.push({
        name: file.name,
        url: URL.createObjectURL(file),
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      });
    }

    if (validFiles.length > 0) {
      setBannerFiles((prev) => [...prev, ...validFiles]);
      setBannerPreviews((prev) => [...prev, ...newPreviews]);
      setBannerFeedback({
        type: 'info',
        text: t(
          `${validFiles.length} image(s) queued for slideshow upload. Click "Upload to Slideshow" below.`,
          `${validFiles.length} फोटो(हरू) अपलोडका लागि तयार छन्। तलको अपलोड बटन थिच्नुहोस्।`
        ),
      });
    }
    e.target.value = '';
  };

  const removeQueuedBannerFile = (indexToRemove) => {
    setBannerFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setBannerPreviews((prev) => {
      const target = prev[indexToRemove];
      if (target?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleBannerUpload = (e) => {
    e.preventDefault();
    if (bannerFiles.length === 0) {
      setBannerFeedback({
        type: 'error',
        text: t('Please select one or more images first.', 'कृपया पहिले कम्तीमा एउटा फोटो छान्नुहोस्।'),
      });
      return;
    }
    const formData = new FormData();
    formData.append('title', bannerTitle);
    formData.append('subtitle', bannerSubtitle);
    formData.append('badge_text', bannerBadge);
    formData.append('is_active', 'true');
    bannerFiles.forEach((file) => {
      formData.append('images', file);
    });
    uploadBannerMutation.mutate(formData);
  };

  const handleReservationSubmit = (e) => {
    e.preventDefault();
    if (!reservingRoom) return;

    const formData = new FormData();
    formData.append('room', reservingRoom.id);
    formData.append('request_type', requestType);
    formData.append('expected_move_in_date', moveInDate);
    formData.append('occupants_count', occupantsCount);
    formData.append('phone_number', phoneNum);
    formData.append('occupation', occupation);
    formData.append('message', message);
    formData.append('token_amount', tokenAmount || '0');
    if (paymentScreenshot) formData.append('payment_screenshot', paymentScreenshot);
    if (citizenshipDoc) formData.append('citizenship_document', citizenshipDoc);

    reserveMutation.mutate(formData);
  };

  const currentBanner = banners[activeSlide] || {
    id: null,
    title: t(
      'Smart House Rental • Ground & 1st Floor',
      'स्मार्ट कोठा भाडा • भुइँ र पहिलो तल्ला'
    ),
    subtitle: t(
      'Sub-metered electricity (Rs. 15/unit) & fixed water (Rs. 100/room)',
      'सब-मिटर बिजुली (रु. १५/युनिट) र निश्चित पानी (रु. १००/कोठा)'
    ),
    badge_text: t('Verified Direct-Landlord Listing', 'घरधनीद्वारा प्रमाणित आवास'),
    resolved_url: DEFAULT_HERO_IMAGE,
  };

  const filterRoomList = (floorCode) => {
    return rooms.filter((r) => {
      const roomNo = String(r.room_number || '').trim().toUpperCase();
      const dbFloor = String(r.floor || '').trim().toUpperCase();

      if (floorCode === 'GROUND') {
        const isGround = dbFloor === 'GROUND' || roomNo.startsWith('A');
        if (!isGround) return false;
      } else if (floorCode === 'FIRST') {
        const isFirst =
          dbFloor === 'FIRST' || dbFloor === 'SECOND' || roomNo.startsWith('B');
        if (!isFirst) return false;
      }

      if (availableOnly && r.is_occupied) return false;
      return true;
    });
  };

  const groundRooms = filterRoomList('GROUND');
  const firstRooms = filterRoomList('FIRST');

  return (
    <div className="w-full">
      {/* COMPACT HOUSE NOTICES BANNER (ONLY SHOWS WHEN ACTIVE NOTICES EXIST) */}
      {notices.length > 0 && (
        <div className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 font-extrabold text-[10px] uppercase shrink-0">
                <BellRing className="w-3 h-3 text-amber-400 animate-pulse" />
                {td(notices[0].category_display || notices[0].category)}
              </span>
              <span className="font-bold text-white truncate">{notices[0].title}:</span>
              <span className="text-slate-300 truncate">{notices[0].content}</span>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
              {notices[0].created_at
                ? formatDualDate(new Date(notices[0].created_at).toISOString().split('T')[0])
                : ''}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLEAN, MINIMAL & VISUAL-FIRST HERO SECTION                                */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left Column: Crisp Headline, Compact Price Chips & Side-by-Side CTAs */}
          <div className="lg:col-span-6 space-y-4 sm:space-y-5">
            {/* Single Sleek Status Pill */}
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-extrabold">
                {t(
                  `${stats.available_rooms} of ${stats.total_rooms} Rooms Available`,
                  `${stats.total_rooms} मध्ये ${stats.available_rooms} कोठा खाली`
                )}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t('Direct Landlord Portal', 'आधिकारिक भाडा पोर्टल')}
              </span>
            </div>

            {/* Clean, Balanced Heading */}
            <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-slate-900 leading-[1.18]">
              {t('Smart, Peaceful Living.', 'आधुनिक र शान्त बसोबास।')}
              <span className="text-indigo-600 block mt-1">
                {t('Digital Sub-Meter Precision.', 'पारदर्शी डिजिटल सब-मिटरिङ।')}
              </span>
            </h1>

            {/* Concise 2-Line Subtitle */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg">
              {t(
                'Transparent sub-metered electricity, 24/7 water supply, and instant digital rent receipts for students and professionals.',
                'प्रत्येक कोठामा छुट्टै सब-मिटर बिजुली, २४ सै घण्टा पानी र तुरुन्तै अनलाइन भाडा रसिद प्राप्त हुने शान्त र सुरक्षित आवास।'
              )}
            </p>

            {/* 3 Compact Visual Rate Cards */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-lg pt-1">
              <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  {t('Small Unit', 'सानो कोठा')}
                </span>
                <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                  {t('Rs. 2,500', 'रु. २,५००')}
                </p>
                <span className="text-[10px] text-slate-500 font-medium">
                  {t('Rooms A3, B4', 'कोठा A3, B4')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-indigo-600 block">
                  {t('Standard', 'स्ट्यान्डर्ड')}
                </span>
                <p className="text-sm sm:text-base font-black text-indigo-700 mt-0.5">
                  {t('Rs. 3,800', 'रु. ३,८००')}
                </p>
                <span className="text-[10px] text-slate-500 font-medium">
                  {t('Spacious Suite', 'ठूलो कोठा')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  {t('Sub-Meter', 'बिजुली / पानी')}
                </span>
                <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                  {t('Rs. 15/u', 'रु. १५/युनिट')}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {t('+ Rs. 100 Water', '+ रु. १०० पानी')}
                </span>
              </div>
            </div>

            {/* Side-by-Side Action Buttons */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 pt-1 max-w-lg">
              <a
                href="#rooms-inventory"
                className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-600/20 transition"
              >
                <span>{t('Explore Rooms', 'कोठा छान्नुहोस्')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </a>

              {user ? (
                <button
                  type="button"
                  onClick={() => navigate(isAdmin ? '/admin-deck' : '/tenant')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 text-xs sm:text-sm font-extrabold shadow-2xs transition"
                >
                  <Home className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {isAdmin
                      ? t('Admin Deck', 'एडमिन प्यानल')
                      : t('My Dashboard', 'मेरो ड्यासबोर्ड')}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('LOGIN')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 text-xs sm:text-sm font-extrabold shadow-2xs transition"
                >
                  <span>{t('Tenant Login', 'भाडावाल लगइन')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Sleek 16:10 Interactive Hero Slideshow Card */}
          <div className="lg:col-span-6">
            <div
              onMouseEnter={() => setIsHoveringHero(true)}
              onMouseLeave={() => setIsHoveringHero(false)}
              className="relative rounded-3xl bg-white p-2 sm:p-3 shadow-xl shadow-indigo-950/5 border border-slate-200/80"
            >
              {/* Main Slideshow Viewport */}
              <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-slate-900 group">
                <img
                  key={currentBanner.id || activeSlide}
                  src={currentBanner.resolved_url}
                  alt={currentBanner.title}
                  onClick={() => setShowLightbox(true)}
                  className="w-full h-full object-cover transition-all duration-700 cursor-pointer group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-slate-950/25 pointer-events-none" />

                {/* Top Left Badge + Slide Counter */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-[11px] font-extrabold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="truncate max-w-[160px] sm:max-w-none">
                      {currentBanner.badge_text || t('Verified Listing', 'प्रमाणित आवास')}
                    </span>
                  </div>

                  {banners.length > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-extrabold border border-white/15">
                      {activeSlide + 1} / {banners.length}
                    </span>
                  )}
                </div>

                {/* Top Right Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {banners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsAutoPlaying((prev) => !prev)}
                      className="p-1.5 sm:p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition"
                      title={
                        isAutoPlaying
                          ? t('Pause Slideshow', 'रोक्नुहोस्')
                          : t('Play Slideshow', 'चलाउनुहोस्')
                      }
                    >
                      {isAutoPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLightbox(true)}
                    className="p-1.5 sm:p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition"
                    title={t('Fullscreen', 'पूरा स्क्रिन')}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowBannerEditor(!showBannerEditor)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold shadow-lg transition"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {showBannerEditor
                            ? t('Close', 'बन्द')
                            : t('Manage Slides', 'फोटो व्यवस्थापन')}
                        </span>
                      </button>
                      {currentBanner.id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  'Delete this slide from the homepage slideshow?',
                                  'यो फोटो स्लाइडशोबाट हटाउने हो?'
                                )
                              )
                            ) {
                              deleteBannerMutation.mutate(currentBanner.id);
                            }
                          }}
                          className="p-1.5 sm:p-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Left / Right Carousel Arrows */}
                {banners.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1))
                      }
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-md transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-md transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Bottom Caption Overlay */}
                <div className="absolute bottom-3 inset-x-3 rounded-2xl bg-white/95 backdrop-blur-md p-3 sm:p-3.5 shadow-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {currentBanner.title}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                        {currentBanner.subtitle ||
                          t(
                            'Sub-metered Power & 24/7 Water Supply',
                            'सब-मिटर बिजुली र २४ सै घण्टा पानी'
                          )}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[11px] shrink-0">
                    {t('Rs. 2.5k–3.8k', 'रु. २.५k–३.८k')}
                  </span>
                </div>
              </div>

              {/* Thumbnail Strip */}
              {banners.length > 1 && (
                <div className="pt-2.5 px-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {banners.map((b, idx) => (
                      <button
                        key={b.id || idx}
                        type="button"
                        onClick={() => setActiveSlide(idx)}
                        className={`relative w-12 h-8 sm:w-14 sm:h-10 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                          idx === activeSlide
                            ? 'border-indigo-600 scale-105'
                            : 'border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={b.resolved_url}
                          alt={b.title}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {banners.map((b, idx) => (
                      <button
                        key={b.id || idx}
                        type="button"
                        onClick={() => setActiveSlide(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === activeSlide ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ADMIN MULTI-IMAGE SLIDESHOW MANAGER PANEL */}
              {isAdmin && showBannerEditor && (
                <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <p className="text-xs font-extrabold text-indigo-900 uppercase">
                        {t(
                          `Slideshow Manager (${banners.length} Slides)`,
                          `स्लाइडशो व्यवस्थापन (${banners.length} फोटो)`
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBannerEditor(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {bannerFeedback.text && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                        bannerFeedback.type === 'error'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span>{bannerFeedback.text}</span>
                      <button
                        type="button"
                        onClick={() => setBannerFeedback({ type: '', text: '' })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleBannerUpload} className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={bannerTitle}
                        onChange={(e) => setBannerTitle(e.target.value)}
                        placeholder={t('Slide Title', 'स्लाइड शीर्षक')}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                        required
                      />
                      <input
                        type="text"
                        value={bannerBadge}
                        onChange={(e) => setBannerBadge(e.target.value)}
                        placeholder={t('Badge Text', 'ब्याज पाठ')}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      placeholder={t('Subtitle description', 'उप-शीर्षक विवरण')}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                    />

                    <label className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-white cursor-pointer transition text-center">
                      <Upload className="w-4 h-4 text-indigo-600 mb-1" />
                      <span className="text-xs font-extrabold text-slate-800">
                        {t('Select Banner Images (Up to 5 MB)', 'ब्यानर फोटो छान्नुहोस् (५ MB सम्म)')}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.avif"
                        multiple
                        onChange={handleSelectMultipleBannerFiles}
                        className="hidden"
                      />
                    </label>

                    {bannerPreviews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {bannerPreviews.map((item, idx) => (
                          <div
                            key={idx}
                            className="relative h-14 rounded-xl overflow-hidden border border-indigo-200 bg-white"
                          >
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeQueuedBannerFile(idx)}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/75 text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={uploadBannerMutation.isPending || bannerFiles.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition"
                      >
                        {uploadBannerMutation.isPending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t('Uploading...', 'अपलोड हुँदैछ...')}
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            {t('Upload Slides', 'अपलोड गर्नुहोस्')}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME INVENTORY: ROOMS A1-A4 & B1-B5 */}
      <section
        id="rooms-inventory"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-slate-200/70"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mb-0.5">
              {t('LIVE ROOM INVENTORY', 'लाइभ कोठा विवरण')}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {t('Available Rooms & Studios', 'उपलब्ध कोठा तथा स्टुडियोहरू')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              {[
                {
                  key: 'ALL',
                  label: t(`All (${rooms.length || 9})`, `सबै (${rooms.length || 9})`),
                },
                {
                  key: 'GROUND',
                  label: t('Ground (A1–A4)', 'भुइँ तल्ला (A1–A4)'),
                },
                {
                  key: 'FIRST',
                  label: t('First (B1–B5)', 'पहिलो तल्ला (B1–B5)'),
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFloorFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    floorFilter === tab.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                availableOnly
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {availableOnly
                ? t('✓ Vacant Only', '✓ खाली मात्र')
                : t('Vacant Only', 'खाली कोठा मात्र')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-9">
            {(floorFilter === 'ALL' || floorFilter === 'GROUND') && (
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {t('Ground Floor (A1–A4)', 'भुइँ तल्ला (A1–A4)')}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">
                    {groundRooms.filter((r) => !r.is_occupied).length}{' '}
                    {t('Available', 'खाली उपलब्ध')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {groundRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      t={t}
                      onAction={() => {
                        if (!user) {
                          openAuthModal('SIGNUP');
                        } else {
                          setReservingRoom(room);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {(floorFilter === 'ALL' || floorFilter === 'FIRST') && (
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {t('First Floor (B1–B5)', 'पहिलो तल्ला (B1–B5)')}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">
                    {firstRooms.filter((r) => !r.is_occupied).length}{' '}
                    {t('Available', 'खाली उपलब्ध')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {firstRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      t={t}
                      onAction={() => {
                        if (!user) {
                          openAuthModal('SIGNUP');
                        } else {
                          setReservingRoom(room);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* HOUSE RULES & GUIDELINES (13 ACCORDION CARDS + HIGHLIGHTED FINES CARD)    */}
      {/* ========================================================================= */}
      <section
        id="house-rules"
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/70 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mb-0.5">
              {t('TENANT CHARTER', 'भाडावाल आचारसंहिता')}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {t('House Rules & Guidelines', 'घरको नियम तथा निर्देशिका')}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setExpandAllRules((prev) => !prev)}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 text-xs font-extrabold shadow-2xs transition"
          >
            {expandAllRules
              ? t('Collapse All', 'सबै संक्षिप्त गर्नुहोस्')
              : t('Expand All 13 Rules', 'सबै १३ नियम हेर्नुहोस्')}
          </button>
        </div>

        {/* 13 ACCORDION CARDS */}
        <div className="space-y-2.5">
          {HOUSE_RULES_CATEGORIES.map((cat, idx) => {
            const isOpen = expandAllRules || openRuleIndex === idx;
            const IconComponent = cat.icon;
            const pointsList = isNepali && cat.itemsNe ? cat.itemsNe : cat.items;

            return (
              <div
                key={cat.id}
                className={`rounded-2xl transition overflow-hidden border ${
                  cat.isHighlightedFineCategory
                    ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (expandAllRules) {
                      setExpandAllRules(false);
                      setOpenRuleIndex(idx);
                    } else {
                      setOpenRuleIndex(isOpen ? -1 : idx);
                    }
                  }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`w-9 h-9 rounded-xl ${cat.iconBg} flex items-center justify-center shrink-0`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`text-xs sm:text-sm font-extrabold ${
                            cat.isHighlightedFineCategory ? 'text-rose-900' : 'text-slate-900'
                          }`}
                        >
                          {isNepali ? cat.titleNe : cat.title}
                        </h3>
                        {cat.isHighlightedFineCategory && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                            {t('Fines', 'जरिवाना')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isNepali ? cat.subtitleNe : cat.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100/90 space-y-3">
                    {cat.isHighlightedFineCategory && (
                      <div className="overflow-x-auto rounded-xl border border-rose-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-rose-50 text-rose-900 font-extrabold uppercase text-[10px] border-b border-rose-200">
                            <tr>
                              <th className="py-2 px-3">{t('Violation', 'उल्लंघन / गल्ती')}</th>
                              <th className="py-2 px-3">{t('Penalty', 'जरिवाना')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100">
                            {DAMAGE_FINE_PENALTIES.map((row, rIdx) => (
                              <tr key={rIdx}>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {isNepali ? row.violationNe : row.violation}
                                </td>
                                <td className="py-2 px-3 font-extrabold text-rose-600">
                                  {isNepali ? row.penaltyNe : row.penalty}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <ul className="space-y-1.5">
                      {pointsList.map((point, pIdx) => (
                        <li
                          key={pIdx}
                          className="flex items-start gap-2 text-xs text-slate-700"
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              cat.isHighlightedFineCategory
                                ? 'text-rose-600'
                                : 'text-indigo-600'
                            }`}
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SEPARATE HIGHLIGHTED CARD FOR DAMAGE FINES & PENALTIES */}
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/50 border border-rose-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {t('Damage Fines & Penalties Schedule', 'क्षति जरिवाना र दण्ड तालिका')}
                </h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-extrabold self-start sm:self-auto">
              {t('Evidence-Backed Policy', 'फोटो प्रमाणसहित लागू हुने')}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 overflow-x-auto rounded-2xl border border-rose-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-600 text-white text-[10px] font-extrabold uppercase">
                  <tr>
                    <th className="py-2.5 px-3.5">{t('Violation', 'उल्लंघन / क्षति विवरण')}</th>
                    <th className="py-2.5 px-3.5">{t('Penalty', 'जरिवाना / दण्ड')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DAMAGE_FINE_PENALTIES.map((item, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/40">
                      <td className="py-2.5 px-3.5 font-bold text-slate-800">
                        {isNepali ? item.violationNe : item.violation}
                      </td>
                      <td className="py-2.5 px-3.5 font-black text-rose-600">
                        {isNepali ? item.penaltyNe : item.penalty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-5 rounded-2xl bg-white p-4 border border-rose-200/90 space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase text-rose-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-600" />{' '}
                {t('Official Fine Guidelines', 'जरिवाना निर्देशिका')}
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {FINE_GUIDELINES_LIST.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{isNepali ? item.ne : item.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* IMPORTANT NOTICE & "I AGREE & ACCEPT" TENANT ACKNOWLEDGMENT CARD */}
        <div className="rounded-3xl bg-slate-900 text-white p-5 sm:p-7 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-400/30">
                <FileCheck2 className="w-3 h-3" />{' '}
                {t('Important Notice', 'महत्त्वपूर्ण सूचना')}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {t(
                  'Tenant Acknowledgment & Responsibility Charter',
                  'भाडावालको सहमति र जिम्मेवारी प्रतिबद्धता'
                )}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t(
                  'By accepting these rules, tenants acknowledge their responsibilities toward maintaining a clean, safe, and peaceful living environment.',
                  'यी नियमहरू स्वीकार गरेर, भाडावालहरूले सफा, सुरक्षित र शान्त वातावरण कायम राख्ने आफ्नो जिम्मेवारी स्वीकार गर्दछन्।'
                )}
              </p>
            </div>

            <div className="shrink-0">
              {hasAcceptedRules ? (
                <div className="px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {t('✓ Rules Acknowledged', '✓ नियमहरू स्वीकार गरियो')}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAcceptHouseRules}
                  disabled={acceptRulesMutation.isPending}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/25 transition inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {acceptRulesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Saving...', 'सुरक्षित हुँदैछ...')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t('I Agree & Accept', 'म सहमत छु र स्वीकार गर्दछु')}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {rulesAckMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
              <span>{rulesAckMsg}</span>
              <button
                type="button"
                onClick={() => setRulesAckMsg('')}
                className="text-emerald-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* FULLSCREEN HERO SLIDESHOW LIGHTBOX MODAL */}
      {showLightbox && (
        <div
          onClick={() => setShowLightbox(false)}
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between text-white pb-3 border-b border-white/10"
          >
            <div>
              <h3 className="text-sm sm:text-base font-extrabold">{currentBanner.title}</h3>
              <p className="text-xs text-slate-400">{currentBanner.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {banners.length > 1 && (
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold">
                  {activeSlide + 1} / {banners.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            {banners.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
                }}
                className="absolute left-2 sm:left-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={currentBanner.resolved_url}
              alt={currentBanner.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            />

            {banners.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 sm:right-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {banners.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 overflow-x-auto py-2"
            >
              {banners.map((b, idx) => (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`w-16 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                    idx === activeSlide
                      ? 'border-indigo-400 scale-105'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={b.resolved_url} alt={b.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROOM RESERVATION & VISIT BOOKING MODAL */}
      {reservingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {t('Book Room', 'कोठा बुक गर्नुहोस्')} {reservingRoom.room_number} (
                  {String(reservingRoom.room_number).startsWith('B')
                    ? t('First Floor', 'पहिलो तल्ला')
                    : t('Ground Floor', 'भुइँ तल्ला')}
                  )
                </h3>
                <p className="text-xs text-slate-500">
                  {t('Base Rent:', 'मासिक भाडा:')} {t('Rs.', 'रु.')}{' '}
                  {Number(reservingRoom.base_rent).toLocaleString()}
                  {t('/month', '/महिना')}
                </p>
              </div>
              <button
                onClick={() => setReservingRoom(null)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reservationMsg.text && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  reservationMsg.type === 'error'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {reservationMsg.text}
              </div>
            )}

            <form onSubmit={handleReservationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('REQUEST TYPE', 'अनुरोधको प्रकार')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestType('RESERVE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      requestType === 'RESERVE'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t('Instant Room Reservation', 'तत्काल कोठा बुकिङ')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType('VISIT')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      requestType === 'VISIT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t('Schedule Physical Visit', 'प्रत्यक्ष कोठा हेर्ने समय')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('EXPECTED MOVE-IN / VISIT DATE (AD)', 'सर्ने वा कोठा हेर्ने मिति (AD)')}
                  </label>
                  <input
                    type="date"
                    required
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                  {moveInDate && (
                    <p className="text-[11px] font-extrabold text-indigo-600 mt-1">
                      📅 {t('BS:', 'नेपाली मिति:')} {formatBSOnly(moveInDate)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('TOTAL OCCUPANTS', 'बस्ने व्यक्ति संख्या')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    required
                    value={occupantsCount}
                    onChange={(e) => setOccupantsCount(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('PHONE NUMBER', 'मोबाइल नम्बर')}
                  </label>
                  <input
                    type="text"
                    required
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="9848800000"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('OCCUPATION / PROFESSION', 'पेशा / अध्ययन')}
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder={t('e.g. BCA Student / IT Intern', 'जस्तै: विद्यार्थी / कर्मचारी')}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {requestType === 'RESERVE' && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <p className="text-xs font-bold text-indigo-900">
                    {t('Token Deposit (Optional)', 'बैना रकम (ऐच्छिक)')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Token Amount (NPR)', 'बैना रकम (रु.)')}
                      </label>
                      <input
                        type="number"
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Payment Screenshot Slip', 'भुक्तानी भौचर फोटो')}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                        className="text-[11px] text-slate-600 pt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t(
                    'CITIZENSHIP / ID CARD PHOTO (FOR KYC ONBOARDING)',
                    'नागरिकता वा परिचयपत्रको फोटो (KYC का लागि)'
                  )}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCitizenshipDoc(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t(
                    'ADDITIONAL NOTES / PREFERRED VISIT TIME',
                    'थप जानकारी वा कोठा हेर्न आउने समय'
                  )}
                </label>
                <textarea
                  rows="2"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t(
                    'Any special inquiries or time preferences...',
                    'कुनै जिज्ञासा वा समय भए उल्लेख गर्नुहोस्...'
                  )}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReservingRoom(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={reserveMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
                >
                  {reserveMutation.isPending
                    ? t('Submitting...', 'पठाउँदै...')
                    : t('Confirm Request', 'अनुरोध पक्का गर्नुहोस्')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onAction, t }) {
  const isSmall = room.room_type === 'SMALL';
  const occupied = room.is_occupied;
  const pendingCount = room.pending_reservations_count || 0;

  return (
    <div
      className={`rounded-2xl bg-white p-4 sm:p-5 border transition flex flex-col justify-between ${
        occupied
          ? 'border-slate-200/70 opacity-90'
          : 'border-indigo-200/80 shadow-sm hover:shadow-md hover:border-indigo-500'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <h4 className="text-base font-extrabold text-slate-900">
              {t('Room', 'कोठा')} {room.room_number}
            </h4>
            {isSmall && (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                {t('Small', 'सानो')}
              </span>
            )}
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              occupied
                ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {occupied ? t('• Occupied', '• बुक छ') : t('• Available', '• खाली छ')}
          </span>
        </div>

        <p className="text-xs text-slate-500 font-medium mb-3">
          {room.title} • {room.area_sqft} {t('sq.ft', 'वर्ग फिट')}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] font-semibold text-slate-700">
            <Droplets className="w-3 h-3 text-emerald-600" />
            {t('Water Rs.', 'पानी रु.')} {Number(room.fixed_water_bill).toFixed(0)}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] font-semibold text-slate-700">
            <Zap className="w-3 h-3 text-amber-500" />
            {t('Elec Rs.', 'बिजुली रु.')} {Number(room.electricity_rate_per_unit).toFixed(0)}/u
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-slate-900">
            {t('Rs.', 'रु.')} {Number(room.base_rent).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            {t('/ month', '/ महिना')}
          </p>
        </div>

        {occupied ? (
          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
            {t('Occupied', 'बुक भइसकेको')}
          </span>
        ) : (
          <button
            onClick={onAction}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition relative"
          >
            {t('Reserve', 'बुक गर्नुहोस्')}
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}