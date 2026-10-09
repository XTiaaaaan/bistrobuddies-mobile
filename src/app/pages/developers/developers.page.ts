import { NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

interface Education {
  school: string;
  program: string;
  period: string;
}

interface SkillEntry {
  name: string;
  level: string; // e.g. "95%", "Advanced", "Native"
}

interface Project {
  name: string;
  stack: string;
  description: string;
}

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

interface Award {
  title: string;
  organization: string;
  year: string;
}

interface WorkExperience {
  role: string;
  company: string;
  period: string;
  highlights: string[];
}

interface Developer {
  name: string;
  photo: string;
  title: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  github?: string;
  linkedin?: string;
  objective: string;
  education: Education[];
  coreSkills: string[];
  technicalSkills: string[];
  programmingLanguages: SkillEntry[];
  projects: Project[];
  certifications: Certification[];
  awards: Award[];
  workExperience: WorkExperience[];
  organizations: string[];
  languages: string[];
  hobbies: string[];
}

@Component({
  selector: 'app-developers',
  templateUrl: './developers.page.html',
  styleUrls: ['./developers.page.scss'],
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class DevelopersPage {
  protected readonly developers: Developer[] = [
    {
      name: 'Joshua Philip S. Baoc',
      photo: 'assets/profiles/baoc.png',
      title: 'IT Specialist',
      role: 'Developer',
      email: 'baocjoshua@gmail.com',
      phone: '0995 207 2469',
      location: 'Quezon City, Philippines',
      github: 'https://github.com/Dokja51-49',
      objective:
        'Motivated IT Specialist offering a balanced foundation in frontend web development, relational databases (SQL, MySQL, Oracle), and interface prototyping with Figma. Combines solid technical fundamentals with advanced team collaboration and communication abilities.',
      education: [
        { school: 'Technological Institute of the Philippines', program: 'BS in Information Technology', period: '2024 – Present' },
        { school: 'APEC Schools North Fairview', program: 'Senior High School, STEM', period: '2022 – 2024' },
      ],
      coreSkills: ['Critical Thinking', 'Adaptability', 'Communication', 'Team Collaboration'],
      technicalSkills: ['HTML/CSS', 'JavaScript', 'MySQL', 'Oracle SQL', 'Git & GitHub', 'Figma'],
      programmingLanguages: [
        { name: 'HTML', level: '90%' },
        { name: 'CSS', level: '90%' },
        { name: 'SQL', level: '75%' },
        { name: 'JavaScript', level: '70%' },
        { name: 'PHP', level: '40%' },
        { name: 'Java', level: '50%' },
      ],
      projects: [
        {
          name: 'JPH Sports Complex',
          stack: 'HTML, CSS, PHP',
          description: 'Sports facility booking system for indoor and outdoor sports venues.',
        },
        {
          name: 'Saklolo161',
          stack: 'React Native, React, REST API, Vite',
          description: 'End-to-end emergency/incident reporting platform connecting citizens with responders through an interactive map.',
        },
        {
          name: 'SilentShift',
          stack: 'C#, Unity',
          description: 'Top-down tactical stealth game with spatial puzzles and security systems.',
        },
      ],
      certifications: [
        { name: 'JavaScript Certification', issuer: 'freeCodeCamp', year: '2026' },
      ],
      awards: [
        { title: 'High Honors', organization: '2024', year: '' },
        { title: 'Merit Award', organization: 'APEC Schools', year: '2023' },
      ],
      workExperience: [],
      organizations: ['JPCS — TIP QC (2026)', 'ACM — TIP QC (2024–2025)'],
      languages: ['Filipino (Native)', 'English (Fluent)'],
      hobbies: ['Gaming', 'Listening to Music', 'Reading Books', 'Chess'],
    },
    {
      name: 'Christian Joshua M. Lacerna',
      photo: 'assets/profiles/lacerna.png',
      title: 'Junior Full-Stack Web Developer',
      role: 'Developer',
      email: 'christianmlacerna@gmail.com',
      phone: '+63 929 435 6917',
      location: 'Rizal, Philippines',
      github: 'https://github.com/XTiaaaaan',
      linkedin: 'https://www.linkedin.com/in/christian-joshua-lacerna-b8830442b/',
      objective:
        'Passionate Full Stack Developer equipped with end-to-end technical expertise and ready to build scalable, high-impact solutions. Adept at transforming complex requirements into clean code, seamless user interfaces, and robust backend systems.',
      education: [
        { school: 'Technological Institute of the Philippines', program: 'BS in Information Technology', period: '2024 – Present' },
        { school: 'Our Lady of Fatima University', program: 'Senior High School, STEM', period: '2022 – 2024' },
        { school: 'Don Antonio De Zuzuarregui Sr. Memorial Academy', program: 'Junior High School', period: '2018 – 2022' },
      ],
      coreSkills: ['Problem Solving', 'Communication', 'Team Collaboration', 'Time Management', 'Adaptability'],
      technicalSkills: ['Frontend Development', 'Backend Development', 'UI/UX Design', 'Database Design'],
      programmingLanguages: [
        { name: 'HTML', level: '94%' },
        { name: 'JavaScript', level: '94%' },
        { name: 'CSS', level: '82%' },
        { name: 'Java', level: '74%' },
        { name: 'SQL', level: '85%' },
        { name: 'PHP', level: '70%' },
      ],
      projects: [
        {
          name: 'Silent Shift',
          stack: 'C#, Unity',
          description: 'A top-down 2D stealth mobile game inspired by "Robbery Bob".',
        },
        {
          name: 'JPH Sports Complex Website',
          stack: 'HTML, CSS, JavaScript, PHP/MySQL',
          description: 'Sports facility booking web system with PHP/MySQL backend supporting court reservations, time-slot scheduling, payment processing, and user account management.',
        },
      ],
      certifications: [
        { name: 'FreeCodeCamp Certification', issuer: 'FreeCodeCamp', year: '2026' },
      ],
      awards: [
        { title: "Dean's Lister (2x)", organization: 'TIP', year: '2024 – Present' },
        { title: "VPAA's Lister (1x)", organization: 'TIP', year: '2024 – Present' },
        { title: 'With High Honors', organization: 'Our Lady of Fatima University', year: 'July 2024' },
        { title: 'With High Honors', organization: 'Don Antonio De Zuzuarregui Sr. Memorial Academy', year: 'May 2022' },
      ],
      workExperience: [],
      organizations: ['JPCS — TIP QC', 'Former ACM — TIP QC'],
      languages: ['English (Fluent)', 'Filipino (Native)'],
      hobbies: ['Gaming', 'Working Out', 'Watching Anime', 'Programming'],
    },
    {
      name: 'Denver Axel J. Marbida',
      photo: 'assets/profiles/marbida.jpg',
      title: 'Junior Full Stack Developer',
      role: 'Developer',
      email: 'qdajmarbida@tip.edu.ph',
      phone: '0921 834 6260',
      location: 'Tanay, Rizal',
      objective:
        'Motivated Junior Full Stack Developer with hands-on experience building cross-platform mobile applications using the Ionic framework and Flutter, and responsive web applications using React and PHP. Passionate about agentic programming, AI-driven automation, and writing clean, maintainable code.',
      education: [
        { school: 'Technological Institute of the Philippines', program: 'BS in Information Technology', period: '2021 – Present' },
        { school: 'STI College Tanay', program: 'Senior High School', period: '2018 – 2020' },
      ],
      coreSkills: ['Problem-solving', 'Communication', 'Adaptability', 'Teamwork', 'Time Management', 'Critical Thinking'],
      technicalSkills: ['Agentic Programming', 'CI/CD Pipelines', 'Version Control (Git)', 'API Integration'],
      programmingLanguages: [
        { name: 'Ionic Framework', level: '92%' },
        { name: 'Flutter', level: '85%' },
        { name: 'HTML', level: '95%' },
        { name: 'CSS', level: '90%' },
        { name: 'JavaScript', level: '85%' },
        { name: 'React', level: '80%' },
        { name: 'PHP', level: '78%' },
      ],
      projects: [
        {
          name: 'Saklolo161',
          stack: 'React Native, React, Vite, REST API',
          description: 'End-to-end emergency/incident reporting platform connecting citizens with responders.',
        },
        {
          name: 'ReadyMAMA',
          stack: 'Flutter, Dart, Firebase',
          description: 'Birth preparedness mobile app guiding expectant mothers through checklists and health resources.',
        },
        {
          name: 'Online Voting System',
          stack: 'HTML, CSS, JavaScript, PHP',
          description: 'Secure web-based voting platform with role-based access, live tallies, and printable results.',
        },
        {
          name: 'KP BeautyCare',
          stack: 'HTML, CSS, JavaScript, PHP',
          description: 'Full-featured e-commerce site with product catalog, shopping cart, and admin dashboard.',
        },
      ],
      certifications: [
        { name: 'JavaScript Algorithms & Data Structures', issuer: 'freeCodeCamp', year: '2024' },
        { name: 'Responsive Web Design', issuer: 'freeCodeCamp', year: '2023' },
        { name: 'AI Essentials & Generative AI Fundamentals', issuer: 'Microsoft Learn', year: '2025' },
        { name: 'The Complete Flutter & Dart Bootcamp', issuer: 'Udemy', year: '2024' },
        { name: 'Continuous Integration & Delivery (CI/CD)', issuer: 'Self-paced', year: '2024' },
      ],
      awards: [
        { title: "Dean's Lister", organization: 'TIP Quezon City', year: '' },
        { title: 'Project Showcase Award', organization: 'Saklolo161', year: '' },
        { title: 'Outstanding Team Collaboration', organization: 'TIP', year: '' },
      ],
      workExperience: [
        {
          role: 'Junior Full Stack Developer',
          company: 'Freelance / Self-employed',
          period: '2023 – Present',
          highlights: [
            'Built cross-platform mobile apps using Ionic and Flutter.',
            'Developed dynamic websites (e-commerce, dashboards, booking systems).',
            'Designed and integrated REST APIs with authentication and real-time data sync.',
          ],
        },
        {
          role: 'Mobile & Web Developer',
          company: 'Saklolo161 Incident Reporting System',
          period: '2024',
          highlights: [
            'Built the incident-reporting mobile app with React Native and web dashboard using React (Vite).',
            'Handled end-to-end API integration and data flow.',
          ],
        },
      ],
      organizations: ['JPCS — TIP QC (2021 – Present)'],
      languages: ['Filipino (Native)', 'English (Professional)'],
      hobbies: ['Programming', 'Billiards', 'Drumming'],
    },
    {
      name: 'Prince Louis P. Quizon',
      photo: 'assets/profiles/quizon.jpg',
      title: 'Creative Technology Manager',
      role: 'Developer',
      email: 'qplquizon@tip.edu.ph',
      phone: '0992 703 3651',
      location: 'Cainta, Rizal',
      objective:
        'Creative Technology Manager with technical foundations in web development, interactive design, and AI prototyping. Passionate about helping teams turn creative visions into working products. Eager to grow more while managing digital projects from initial idea to launch.',
      education: [
        { school: 'Technological Institute of the Philippines', program: 'BS in Information Technology', period: '2024 – Present' },
        { school: 'ICCT College', program: 'Senior High School', period: '2022 – 2024' },
        { school: 'Sta. Elena High School', program: 'Junior High School', period: '2018 – 2022' },
      ],
      coreSkills: ['Critical Thinking', 'Collaboration', 'Adaptability'],
      technicalSkills: ['Prototyping', 'Technical Guidance', 'UI/UX Design'],
      programmingLanguages: [
        { name: 'Ionic Framework', level: '60%' },
        { name: 'Flutter', level: '68%' },
        { name: 'HTML', level: '65%' },
        { name: 'CSS', level: '65%' },
        { name: 'JavaScript', level: '65%' },
        { name: 'React', level: '60%' },
        { name: 'PHP', level: '60%' },
      ],
      projects: [
        {
          name: 'PawradiseHome',
          stack: 'HTML, JavaScript, CSS, PHP',
          description: 'End-to-end pet adoption platform connecting rescued animals with loving homes.',
        },
        {
          name: 'Saklolo161',
          stack: 'React Native, React, Vite, REST API',
          description: 'Emergency/incident reporting platform connecting citizens with responders.',
        },
        {
          name: 'SilentShift',
          stack: 'C#, Unity',
          description: 'Top-down tactical stealth game with spatial puzzles.',
        },
      ],
      certifications: [
        { name: 'JavaScript Algorithms & Data Structures', issuer: 'freeCodeCamp', year: '2026' },
      ],
      awards: [],
      workExperience: [],
      organizations: ['JPCS — TIP QC (2026 – Present)'],
      languages: ['Filipino (Native)', 'English (Intermediate)'],
      hobbies: ['Basketball', 'Pickleball', 'Gaming', 'Arts & Crafts'],
    },
    {
      name: 'Hanz Austin P. Sicat',
      photo: 'assets/profiles/sicat.png',
      title: 'IT Specialist',
      role: 'Developer',
      email: 'hanzsicat00@gmail.com',
      phone: '0938 938 2916',
      location: 'Cainta, Rizal',
      objective:
        'Detail-oriented and proactive IT Specialist with strong fundamentals in hardware troubleshooting, scripting, and web development. Seeking an entry-level IT role where I can apply my technical skills and grow in a professional environment.',
      education: [
        { school: 'Technological Institute of the Philippines', program: 'BS in Information Technology', period: '2024 – Present' },
        { school: 'Sta. Elena High School', program: 'Senior High School', period: '2022 – 2024' },
        { school: 'Sta. Elena High School', program: 'Junior High School', period: '2017 – 2021' },
      ],
      coreSkills: ['Hardware Troubleshooting', 'Technical Support', 'Problem-solving', 'Analytical Thinking'],
      technicalSkills: ['Hardware Troubleshooting', 'Scripting: PowerShell, Bash'],
      programmingLanguages: [
        { name: 'C++', level: '—' },
        { name: 'JavaScript', level: '—' },
        { name: 'Java', level: '—' },
        { name: 'HTML/CSS', level: '—' },
      ],
      projects: [
        {
          name: 'Saklolo 161',
          stack: '—',
          description: 'Incident reporting application.',
        },
        {
          name: 'Silent Shift',
          stack: 'C#, Unity',
          description: 'A stealth game.',
        },
        {
          name: 'Bistro Buddies',
          stack: 'Ionic Framework',
          description: 'Coffee ordering and sales mobile application.',
        },
      ],
      certifications: [
        { name: 'Basic JavaScript', issuer: 'freeCodeCamp', year: '—' },
      ],
      awards: [
        { title: 'With Honor', organization: 'Grade 11', year: '2023' },
        { title: 'With Honor', organization: 'Grade 12', year: '2024' },
      ],
      workExperience: [],
      organizations: ['JPCS'],
      languages: ['Filipino (Native)', 'English (Proficient)'],
      hobbies: ['Exploring New Technologies', 'Gaming', 'Troubleshooting Hardware'],
    },
  ];
}