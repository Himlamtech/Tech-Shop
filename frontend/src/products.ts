import { Product } from "./types";

export const PRODUCTS: Product[] = [
  {
    id: "ar-spectacles",
    name: "Aether Glass Pro",
    price: 899,
    category: "Wearables",
    rating: 4.8,
    reviewsCount: 142,
    tag: "AI Intelligence First",
    description: "Augmented Reality glasses with neural gesture control, real-time translations, and high-contrast micro-LED lenses that blend digital intelligence with the physical world seamlessly.",
    image: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&q=80&w=800",
    features: [
      "Real-time visual HUD with AI translation overlay",
      "Neural bone conduction audio for discreet voice feedback",
      "Hand and eye tracking sensors with sub-millimeter precision",
      "Up to 8 hours of continuous mixed-reality usage"
    ],
    specs: [
      { label: "Display", value: "Dual Micro-LED, 4K equivalent per eye" },
      { label: "Processor", value: "Aether AI Neural Core v3" },
      { label: "Battery Life", value: "8 Hours (AR Mode) / 16 Hours (Eco)" },
      { label: "Connectivity", value: "Wi-Fi 7, Bluetooth 5.4, UWB" },
      { label: "Weight", value: "78 grams (Ultra-light titanium frame)" }
    ],
    reviews: [
      {
        id: "rev-ar-1",
        author: "Marcus Vance",
        rating: 5,
        text: "The real-time translation module on this is mind-blowing. I was walking through Shibuya and felt like a local. Truly futuristic.",
        date: "2026-04-12"
      },
      {
        id: "rev-ar-2",
        author: "Sarah Jenkins",
        rating: 4,
        text: "Incredibly light for AR glasses, though the arm gets slightly warm during intense AI processing. Hopefully next firmware update runs cooler.",
        date: "2026-04-20"
      },
      {
        id: "rev-ar-3",
        author: "Kei Tanaka",
        rating: 5,
        text: "Excellent HUD brightness even in bright sunlight. The companion app connects effortlessly.",
        date: "2026-05-02"
      }
    ],
    aiOverview: "Recommended for professionals and early adopters seeking hands-free navigation and seamless live summaries of the surrounding environment. Excellent display brightness combined with incredibly light, functional titanium aesthetics."
  },
  {
    id: "anc-headphones",
    name: "Quantum Sound H1",
    price: 349,
    category: "Audio",
    rating: 4.9,
    reviewsCount: 389,
    tag: "Acoustic Masterclass",
    description: "High-resolution wireless headphones highlighting adaptive noise-cancellation powered by spatial hearing algorithms that dynamically tune acoustic resonance for your unique ear canal.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800",
    features: [
      "Dynamic Head Tracking for 360-degree spatial acoustics",
      "True ANC targeting up to 45dB of surrounding noise",
      "Bespoke 40mm beryllium-coated dynamic drivers",
      "Unmatched 48-hour ultra long play runtime with fast charging"
    ],
    specs: [
      { label: "Drivers", value: "40mm Beryllium High-Definition Drivers" },
      { label: "ANC Level", value: "Smart Hybrid ANC up to 45dB reduction" },
      { label: "Audio Codecs", value: "LDAC, AAC, aptX Adaptive, LC3" },
      { label: "Battery", value: "48 Hours with ANC On, 65 Hours ANC Off" },
      { label: "Water Resistance", value: "IPX4 water and sweat resistance" }
    ],
    reviews: [
      {
        id: "rev-aud-1",
        author: "Elena Petrova",
        rating: 5,
        text: "The Beryllium drivers deliver punchy, detailed lows and immaculate crystalline highs. Best sounding ANC headphones I've owned.",
        date: "2026-03-30"
      },
      {
        id: "rev-aud-2",
        author: "David Kim",
        rating: 5,
        text: "Active noise cancellation completely silences the rumbling during my daily trans-Pacific flights. Battery life seems infinite.",
        date: "2026-04-18"
      }
    ],
    aiOverview: "Perfect for audiophiles and remote workers prioritizing top-notch silence and musical fidelity. Features state-of-the-art hybrid ANC that adjusts intelligently to high-frequency environments."
  },
  {
    id: "titanium-smartwatch",
    name: "Chrono Dial T1",
    price: 499,
    category: "Wearables",
    rating: 4.7,
    reviewsCount: 211,
    tag: "Indestructible Luxury",
    description: "Premium smartwatch crafted from grade-5 military titanium and sapphire glass, housing continuous non-invasive biosensors and dual-band GPS with map predictive tracking.",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
    features: [
      "Grade-5 Aerospace Titanium casing with sandblasted finish",
      "Advanced photoplethysmography sensor for cardiac reporting",
      "Dual-frequency L1 + L5 GNSS for precise remote tracking",
      "Solar charging crystal extending performance up to 21 days"
    ],
    specs: [
      { label: "Material", value: "Grade-5 Titanium, Sapphire Crystal Lens" },
      { label: "Sensors", value: "ECG, SpO2, HRV, Hydration, Skin Temp" },
      { label: "Water Rating", value: "10 ATM (Submersible up to 100 meters)" },
      { label: "GPS", value: "Dual-band multi-constellation satellite GPS" },
      { label: "Battery Life", value: "Up to 14 days standard / 21 days with Solar" }
    ],
    reviews: [
      {
        id: "rev-wat-1",
        author: "Liam O'Connor",
        rating: 4,
        text: "I took this hiking in the Swiss Alps and the GPS tracking was pinpoint precise. Battery barely drained, solar element really works.",
        date: "2026-04-05"
      },
      {
        id: "rev-wat-2",
        author: "Maya Patel",
        rating: 5,
        text: "A beautiful fusion of luxury craftsmanship and advanced health metrics. Skin temperature tracking caught my fever early.",
        date: "2026-05-10"
      }
    ],
    aiOverview: "Recommended for outdoor explorers and health-tracking enthusiasts demanding high metric accuracy and rugged materials. Capable of surviving heavy elemental wear with extensive solar battery storage."
  },
  {
    id: "mech-keyboard",
    name: "Nexus Key Zero",
    price: 219,
    category: "Peripherals",
    rating: 4.9,
    reviewsCount: 95,
    tag: "Developer Specialty",
    description: "Compact 75% hot-swappable mechanical keyboard featuring solid CNC aluminum housing, magnetic Hall Effect dynamic switches, and sound-absorbing silicone dampening pads.",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800",
    features: [
      "Magnetic Hall Effect linear switches with adjustable actuation",
      "Solid 1.8kg bead-blasted aluminum case for maximum stability",
      "Dual gas-mount structure with double-shot PBT keycaps",
      "Rapid Trigger feature for ultra-fast keystroke resetting"
    ],
    specs: [
      { label: "Layout", value: "75% ANSI layout (82 Keys)" },
      { label: "Switch Type", value: "Linear Hall Effect Switches (Rapid Trigger)" },
      { label: "Actuation Range", value: "Fully adjustable from 0.1mm to 4.0mm" },
      { label: "Material", value: "Full CNC Aluminum 6063 Case" },
      { label: "Polling Rate", value: "8000Hz wired / 1000Hz professional wireless" }
    ],
    reviews: [
      {
        id: "rev-key-1",
        author: "Alex Rivers",
        rating: 5,
        text: "Rapid Trigger has completely transformed my gaming sessions. The acoustics are creamy and deep without sounding hollow.",
        date: "2026-03-15"
      },
      {
        id: "rev-key-2",
        author: "Chen Wei",
        rating: 5,
        text: "The heaviest, sturdiest keyboard I've ever owned. Zero desk slide. Adjusting actuation keys for typing vs gaming is extremely useful.",
        date: "2026-05-01"
      }
    ],
    aiOverview: "An absolute powerhouse for competitive gamers and intensive typists who value acoustic richness and dynamic keystroke response. The CNC chassis provides amazing weight and desk isolation."
  },
  {
    id: "smart-projector",
    name: "Aura Beam Q1",
    price: 1299,
    category: "Home Tech",
    rating: 4.6,
    reviewsCount: 78,
    tag: "Visual Splendor",
    description: "An incredibly compact, portable laser projector with 4K resolution, integrated Dolby Atmos chamber audio, and advanced AI digital keystone and autofocus sensors.",
    image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&q=80&w=800",
    features: [
      "Triple Laser ALPD engine outputting 2200 ANSI Lumens",
      "Dynamic obstacle avoidance and automatic wall color adjustment",
      "Dual 15W high-density speakers designed with harman/kardon",
      "Runs native Smart OS with 8K media hardware decoding"
    ],
    specs: [
      { label: "Projector Class", value: "Triple Laser ALPD projector" },
      { label: "Native Resolution", value: "UHD 4K (3840 x 2160 pixels)" },
      { label: "Brightness", value: "2200 ANSI Lumens / 2600 Light Source Lumens" },
      { label: "Contrast Ratio", value: "3000:1 Static / 1,000,000:1 Dynamic" },
      { label: "Sound System", value: "Harman Kardon Dolby Audio Speakers" }
    ],
    reviews: [
      {
        id: "rev-prj-1",
        author: "Johnathan Smith",
        rating: 4,
        text: "Amazing image quality, works impressively well even with the curtains open. Built-in Harman Kardon speakers pack shocking bass.",
        date: "2026-02-18"
      },
      {
        id: "rev-prj-2",
        author: "Emily Watson",
        rating: 5,
        text: "Keystone correction dynamically auto-adjusts in half a second whenever my cat bumps the unit. A fantastic upgrade to our living room.",
        date: "2026-04-28"
      }
    ],
    aiOverview: "Recommended for home theater enthusiasts who prefer portability without sacrificing brightness and color richness. Excels at auto-keystoning and adjusting to colored wall surfaces."
  },
  {
    id: "ergonomic-trackpad",
    name: "Core Pad Space",
    price: 159,
    category: "Peripherals",
    rating: 4.8,
    reviewsCount: 112,
    tag: "Ergonomic Future",
    description: "Premium spatial touch-surface incorporating solid haptic feedback actuators, customizable macro corners, and dual glass surface tilting options for ultimate joint relief.",
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&q=80&w=800",
    features: [
      "Custom force haptic motors simulating realistic dial turns",
      "OLED touch strip for high-frequency app navigation shortcuts",
      "Dual angle mechanical kickstands for 10% or 20% surface incline",
      "Continuous pressure-sensing surface recognizing 4096 touch levels"
    ],
    specs: [
      { label: "Surface Layer", value: "Micro-textured chem-strengthened glass" },
      { label: "Haptics", value: "Quad linear electromagnets with custom feedback" },
      { label: "Battery Life", value: "Up to 3 months on a single USB-C charge" },
      { label: "Incline", value: "Flat, 10-degree, and 20-degree physical adjust" },
      { label: "Compatibility", value: "Windows, macOS, iPadOS, Linux out of box" }
    ],
    reviews: [
      {
        id: "rev-tpad-1",
        author: "Oliver Reed",
        rating: 5,
        text: "The wrist strain has completely vanished. The customizable corner macros allow me to glide through video editing timelines.",
        date: "2026-03-10"
      },
      {
        id: "rev-tpad-2",
        author: "Gemma Foster",
        rating: 4,
        text: "Extremely smooth glass top. The pressure sensing drawing works surprisingly well with a capacitive stylus.",
        date: "2026-04-22"
      }
    ],
    aiOverview: "Perfect for digital design professionals and spreadsheet wizards experiencing wrist strain. The tilting kickstands provide genuine anatomical alignment during long sessions."
  }
];
