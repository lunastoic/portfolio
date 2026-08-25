export interface Project {
  id: string;
  /** File-browser style label shown in the projects list */
  fileName: string;
  title: string;
  tagline: string;
  description: string;
  tech: string[];
  features: string[];
  /** Replace with a real link when ready; "#" renders as a disabled-style placeholder */
  githubUrl: string;
  liveUrl: string;
  /** Optional path to a screenshot in /public — placeholder box shown when empty */
  screenshot?: string;
}

export const projects: Project[] = [
  {
    id: "blackjack-counter",
    fileName: "01_BLACKJACK_COUNTER",
    title: "Blackjack Card Counting Game",
    tagline: "Mobile training game for learning to count cards.",
    description:
      "A mobile app built to teach and drill blackjack card counting. Players practice keeping a running count against a dealer in real time, with feedback on accuracy and speed so the skill actually sticks.",
    tech: ["React Native", "TypeScript", "Mobile UI", "Game Logic"],
    features: [
      "Hi-Lo running count training mode",
      "Real-time dealer simulation",
      "Accuracy + speed feedback after each round",
      "Progressive difficulty as counting improves",
    ],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    id: "dog-groomers",
    fileName: "02_DOG_GROOMERS_SITE",
    title: "Full Stack Dog Groomers Website",
    tagline: "Full stack site with booking for a grooming business.",
    description:
      "A full stack website for a dog grooming business. Customers can browse services and request appointments through a booking-style flow, while the business gets a clean way to manage incoming requests.",
    tech: ["Next.js", "TypeScript", "Node.js", "Full Stack"],
    features: [
      "Service catalog with pricing",
      "Booking-style appointment requests",
      "Mobile-friendly customer experience",
      "Business-facing request management",
    ],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    id: "auto-shop",
    fileName: "03_AUTO_SHOP_FRONTEND",
    title: "Front End Website for Auto Shop",
    tagline: "Front-end site focused on customer inquiries.",
    description:
      "A front-end website for a local auto shop. The site presents services and shop info clearly and funnels visitors into a customer inquiry form so the shop never misses a lead.",
    tech: ["React", "JavaScript", "CSS", "Responsive Design"],
    features: [
      "Service and shop information pages",
      "Customer inquiry form with validation",
      "Fully responsive layout",
      "Fast, lightweight front end",
    ],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    id: "drone-pathing",
    fileName: "04_DRONE_FLIGHT_PATH",
    title: "Drone Optimization Flight Path",
    tagline: "Optimizing drone flight paths algorithmically.",
    description:
      "A project focused on computing optimized flight paths for drones — minimizing travel distance and energy use while covering required waypoints. Heavy on algorithms and pathfinding.",
    tech: ["Python", "Pathfinding Algorithms", "Optimization", "Simulation"],
    features: [
      "Waypoint-based route optimization",
      "Distance / energy cost minimization",
      "Path visualization",
      "Configurable constraints",
    ],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    id: "snack-run",
    fileName: "05_SNACK_RUN",
    title: "Snack Run Mobile App",
    tagline: "A mobile game project called Snack Run.",
    description:
      "Snack Run is a mobile game app project — fast, playful, and built to be picked up in short sessions. Designed and developed end to end as a mobile experience.",
    tech: ["Mobile Development", "Game Design", "TypeScript"],
    features: [
      "Pick-up-and-play game loop",
      "Custom game assets and UI",
      "Touch-first controls",
      "Score tracking",
    ],
    githubUrl: "#",
    liveUrl: "#",
  },
];
