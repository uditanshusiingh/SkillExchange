import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Award, Bell, Bookmark, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Eye, EyeOff, Languages, Menu, MessageCircle, Moon, Search, Settings, Share2, ShieldCheck, Sparkles, Star, Sun, Target, Repeat2, UserRound, UsersRound, Video, X, XCircle } from 'lucide-react';
import { blockUser, changePassword, createProfile, createVideoRoom, deleteAccount, deleteAdminUser, forgotPassword, getAdminUsers, getExchanges, getGroups, getLeaderboard, getMessages, getNotifications, getPeople, getPublicProfile, getRecommendations, getSkillMatches, getSkills, joinGroup, loginProfile, markMessageRead, markNotificationsRead, reportUser, resetPassword, scheduleExchange, sendAdminVerification, sendMessage, sendVerification, updateExchange, updatePortfolio, updateProfile, verifyEmail, getPlatformStatus } from './api';
import { connectChat } from './socket';

const categories = ['All', 'Technology', 'Creative', 'Food & home', 'Wellbeing'];

function matchesSearchText(text, query) {
  const normalizedQuery = String(query || '').toLowerCase().trim();
  if (!normalizedQuery) return true;
  const haystack = String(text || '').toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => haystack.includes(token))) return true;

  // Support searches split across words/typos such as "ku hh" -> "kuchh".
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]+/g, '');
  const compactHaystack = haystack.replace(/[^a-z0-9]+/g, '');
  if (!compactQuery) return false;
  if (compactHaystack.includes(compactQuery)) return true;

  // Small typo tolerance: query characters may appear in order with gaps.
  let queryIndex = 0;
  for (const character of compactHaystack) {
    if (character === compactQuery[queryIndex]) queryIndex += 1;
    if (queryIndex === compactQuery.length) return true;
  }
  return false;
}

const people = [];
const persistentPages = ['explore', 'people', 'community', 'advanced'];
const skillOptions = [...new Set([
  'C', 'C++', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'Dart', 'PHP', 'Ruby', 'R', 'MATLAB', 'Scala', 'Solidity', 'Lua', 'Perl', 'Bash', 'PowerShell', 'Assembly', 'SQL',
  'HTML', 'CSS', 'Bootstrap', 'Tailwind CSS', 'Sass', 'React', 'Angular', 'Vue.js', 'Next.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Laravel', 'Flutter', 'React Native',
  'DOM', 'BOM', 'JSON', 'XML', 'AJAX', 'Fetch API', 'REST API', 'GraphQL', 'WebSocket', 'WebRTC', 'JWT', 'OAuth', 'API Gateway', 'Microservices', 'Serverless Architecture', 'MVC', 'MVVM',
  'Object-Oriented Programming (OOP)', 'Class', 'Object', 'Encapsulation', 'Abstraction', 'Inheritance', 'Polymorphism', 'Constructor', 'Destructor', 'Method Overloading', 'Method Overriding', 'Virtual Functions', 'Pure Virtual Functions', 'Interface', 'Abstract Class', 'Multiple Inheritance', 'Templates', 'Generics', 'Exception Handling', 'Operator Overloading', 'Friend Function', 'Pointers', 'References', 'Memory Management', 'Smart Pointers',
  'Data Structures', 'Algorithms', 'Arrays', 'Strings', 'Linked List', 'Doubly Linked List', 'Circular Linked List', 'Stack', 'Queue', 'Circular Queue', 'Deque', 'Priority Queue', 'Hashing', 'Hash Table', 'Heap', 'Binary Tree', 'Binary Search Tree', 'AVL Tree', 'Red-Black Tree', 'B Tree', 'B+ Tree', 'Trie', 'Segment Tree', 'Fenwick Tree', 'Graph', 'Directed Graph', 'Undirected Graph', 'Weighted Graph', 'Union-Find / Disjoint Set', 'Recursion', 'Backtracking', 'Divide and Conquer', 'Greedy Algorithms', 'Dynamic Programming', 'Sliding Window', 'Two Pointers', 'Bit Manipulation', 'String Matching', 'KMP Algorithm', 'Rabin-Karp Algorithm', 'Z Algorithm', 'Computational Geometry', 'BFS', 'DFS', 'Dijkstra Algorithm', 'Bellman-Ford Algorithm', 'Floyd-Warshall Algorithm', 'Prim\'s Algorithm', 'Kruskal\'s Algorithm', 'Topological Sort', 'Time Complexity', 'Space Complexity', 'Big O', 'Big Theta', 'Big Omega',
  'DBMS', 'Relational Database', 'ER Model', 'ER Diagram', 'Relational Model', 'Database Keys', 'Primary Key', 'Foreign Key', 'Candidate Key', 'Super Key', 'Composite Key', 'Normalization', '1NF', '2NF', '3NF', 'BCNF', 'Functional Dependency', 'Multivalued Dependency', 'DDL', 'DML', 'DCL', 'TCL', 'SQL Joins', 'Subqueries', 'Views', 'Stored Procedures', 'Triggers', 'Transactions', 'ACID Properties', 'Concurrency Control', 'Serializability', 'Deadlock', 'Database Recovery', 'Indexing', 'B Tree Index', 'B+ Tree Index', 'Hash Index', 'Query Optimization', 'Distributed Database', 'Database Replication', 'Database Sharding', 'CAP Theorem', 'NoSQL', 'MongoDB', 'MySQL', 'PostgreSQL', 'Oracle Database', 'SQL Server', 'SQLite', 'Redis', 'Cassandra', 'Neo4j', 'Firebase', 'Data Warehousing', 'Data Mining', 'OLTP', 'OLAP', 'ETL', 'Data Lake',
  'Operating Systems', 'Process', 'Thread', 'Multithreading', 'Process Scheduling', 'FCFS', 'SJF', 'SRTF', 'Round Robin', 'Priority Scheduling', 'Process Synchronization', 'Critical Section', 'Mutex', 'Semaphore', 'Monitor', 'Deadlock', 'Banker\'s Algorithm', 'Memory Management', 'Paging', 'Segmentation', 'Virtual Memory', 'Page Replacement', 'FIFO', 'LRU', 'Optimal Page Replacement', 'Thrashing', 'File System', 'Disk Scheduling', 'System Calls', 'Kernel', 'Interrupts', 'Inter-Process Communication', 'Context Switching', 'Linux', 'Unix', 'Windows Internals', 'Shell Scripting',
  'Computer Networks', 'OSI Model', 'TCP/IP Model', 'Physical Layer', 'Data Link Layer', 'Network Layer', 'Transport Layer', 'Session Layer', 'Presentation Layer', 'Application Layer', 'Ethernet', 'MAC Address', 'IP Address', 'IPv4', 'IPv6', 'Subnetting', 'CIDR', 'ARP', 'DHCP', 'DNS', 'HTTP', 'HTTPS', 'FTP', 'SMTP', 'POP3', 'IMAP', 'TCP', 'UDP', 'Routing', 'Routing Algorithms', 'RIP', 'OSPF', 'BGP', 'Switching', 'VLAN', 'NAT', 'Firewall', 'VPN', 'Proxy', 'Load Balancing', 'Congestion Control', 'Flow Control', 'Error Control', 'CSMA/CD', 'CSMA/CA', 'ALOHA', 'Socket Programming', 'Network Security',
  'Computer Architecture', 'CPU', 'ALU', 'Control Unit', 'Registers', 'Cache Memory', 'RAM', 'ROM', 'Memory Hierarchy', 'Instruction Set Architecture', 'RISC', 'CISC', 'Pipelining', 'Pipeline Hazards', 'Branch Prediction', 'Cache Mapping', 'Direct Mapping', 'Associative Mapping', 'Set Associative Mapping', 'Parallel Processing', 'Multiprocessor Systems', 'GPU Architecture',
  'Digital Logic', 'Boolean Algebra', 'Logic Gates', 'Combinational Circuits', 'Sequential Circuits', 'Flip-Flops', 'Registers', 'Counters', 'Multiplexers', 'Demultiplexers', 'Encoders', 'Decoders', 'Karnaugh Map', 'Finite State Machines',
  'Discrete Mathematics', 'Set Theory', 'Relations', 'Functions', 'Logic', 'Propositional Logic', 'Predicate Logic', 'Graph Theory', 'Trees', 'Combinatorics', 'Permutation', 'Combination', 'Recurrence Relations', 'Number Theory', 'Mathematical Proofs',
  'Theory of Computation', 'Automata Theory', 'Finite Automata', 'DFA', 'NFA', 'Regular Expression', 'Regular Language', 'Context-Free Grammar', 'Pushdown Automata', 'Turing Machine', 'Chomsky Hierarchy', 'Pumping Lemma', 'Decidability', 'Undecidability', 'Halting Problem',
  'Compiler Design', 'Compiler', 'Interpreter', 'Lexical Analysis', 'Tokens', 'Lexemes', 'Syntax Analysis', 'Parsing', 'Parse Tree', 'LL Parser', 'LR Parser', 'SLR Parser', 'CLR Parser', 'LALR Parser', 'Semantic Analysis', 'Symbol Table', 'Intermediate Code', 'Three Address Code', 'Code Optimization', 'Code Generation', 'Register Allocation',
  'Software Engineering', 'SDLC', 'Waterfall Model', 'Agile', 'Scrum', 'Kanban', 'Requirement Engineering', 'Software Requirements Specification', 'UML', 'Use Case Diagram', 'Class Diagram', 'Sequence Diagram', 'Activity Diagram', 'Software Architecture', 'Design Patterns', 'SOLID Principles', 'Unit Testing', 'Integration Testing', 'System Testing', 'Regression Testing', 'Black Box Testing', 'White Box Testing', 'Test Driven Development', 'Continuous Integration', 'Continuous Deployment', 'CI/CD', 'Version Control', 'Git', 'GitHub', 'GitLab', 'Bitbucket',
  'System Design', 'High-Level Design', 'Low-Level Design', 'Scalability', 'Availability', 'Reliability', 'Fault Tolerance', 'Caching', 'Horizontal Scaling', 'Vertical Scaling', 'Database Scaling', 'Message Queues', 'Apache Kafka', 'RabbitMQ', 'Event-Driven Architecture', 'Distributed Systems', 'Distributed Transactions', 'Consensus Algorithms', 'Paxos', 'Raft', 'Consistency', 'Eventual Consistency',
  'Artificial Intelligence (AI)', 'Intelligent Agents', 'Expert Systems', 'Knowledge Representation', 'Search Algorithms', 'A* Algorithm', 'Minimax', 'Alpha-Beta Pruning', 'Planning', 'Reasoning', 'Natural Language Processing (NLP)', 'Computer Vision', 'Speech Recognition', 'Robotics',
  'Machine Learning (ML)', 'Supervised Learning', 'Unsupervised Learning', 'Semi-Supervised Learning', 'Reinforcement Learning', 'Linear Regression', 'Logistic Regression', 'Polynomial Regression', 'Decision Tree', 'Random Forest', 'Support Vector Machine', 'K-Nearest Neighbors', 'Naive Bayes', 'Gradient Boosting', 'XGBoost', 'LightGBM', 'CatBoost', 'K-Means Clustering', 'DBSCAN', 'Hierarchical Clustering', 'Principal Component Analysis (PCA)', 'Anomaly Detection', 'Feature Engineering', 'Feature Selection', 'Cross Validation', 'Hyperparameter Optimization', 'Regularization', 'L1 Regularization', 'L2 Regularization', 'Bias-Variance Tradeoff', 'Overfitting', 'Underfitting', 'Confusion Matrix', 'Precision', 'Recall', 'F1 Score', 'ROC Curve', 'AUC', 'Mean Squared Error', 'Mean Absolute Error',
  'Deep Learning', 'Artificial Neural Network', 'Perceptron', 'Multilayer Perceptron', 'Convolutional Neural Network (CNN)', 'Recurrent Neural Network (RNN)', 'LSTM', 'GRU', 'Autoencoder', 'Variational Autoencoder', 'Generative Adversarial Network (GAN)', 'Transformers', 'Attention Mechanism', 'Self-Attention', 'Multi-Head Attention', 'Backpropagation', 'Gradient Descent', 'Stochastic Gradient Descent', 'Adam Optimizer', 'Batch Normalization', 'Dropout', 'Activation Functions', 'ReLU', 'Sigmoid', 'Tanh', 'Transfer Learning', 'Fine-Tuning',
  'Natural Language Processing (NLP)', 'Tokenization', 'Stemming', 'Lemmatization', 'Stop Words', 'Bag of Words', 'TF-IDF', 'Word Embeddings', 'Word2Vec', 'GloVe', 'Named Entity Recognition', 'Part-of-Speech Tagging', 'Sentiment Analysis', 'Text Classification', 'Language Modeling', 'Machine Translation', 'Question Answering', 'Text Summarization', 'Information Extraction', 'Speech Processing',
  'Generative AI', 'Large Language Models (LLMs)', 'GPT', 'Prompt Engineering', 'Prompt Optimization', 'Embeddings', 'Vector Databases', 'Retrieval-Augmented Generation (RAG)', 'Fine-Tuning', 'LoRA', 'PEFT', 'AI Agents', 'Agentic AI', 'Tool Calling', 'Function Calling', 'Multimodal AI', 'LLM Evaluation', 'AI Evaluation', 'Hallucination Detection', 'AI Guardrails', 'LangChain', 'LangGraph', 'Hugging Face', 'Ollama', 'Pinecone', 'Chroma', 'Weaviate',
  'Computer Vision', 'Image Processing', 'Image Classification', 'Object Detection', 'Image Segmentation', 'Face Recognition', 'Optical Character Recognition (OCR)', 'OpenCV', 'YOLO', 'R-CNN', 'Faster R-CNN', 'Vision Transformers', 'Image Generation', 'Image Captioning', 'Image Enhancement', 'Image Restoration', 'Edge Detection', 'Noise Reduction', 'Morphological Processing', 'Fourier Transform', 'Wavelet Transform',
  'Data Science', 'Data Analysis', 'Data Cleaning', 'Data Preprocessing', 'Exploratory Data Analysis', 'Data Visualization', 'Statistics', 'Probability', 'Descriptive Statistics', 'Inferential Statistics', 'Hypothesis Testing', 'Correlation Analysis', 'Regression Analysis', 'Time Series Analysis', 'Forecasting', 'NumPy', 'Pandas', 'Matplotlib', 'Seaborn', 'Scikit-learn', 'Jupyter Notebook',
  'Big Data', 'Hadoop', 'HDFS', 'MapReduce', 'Apache Spark', 'Spark SQL', 'PySpark', 'Apache Hive', 'Apache HBase', 'Data Pipeline', 'Data Engineering', 'Stream Processing', 'Batch Processing',
  'Cloud Computing', 'Virtualization', 'Containers', 'Docker', 'Docker Compose', 'Kubernetes', 'AWS', 'Microsoft Azure', 'Google Cloud', 'Amazon EC2', 'Amazon S3', 'AWS Lambda', 'Amazon RDS', 'Amazon DynamoDB', 'Amazon VPC', 'AWS IAM', 'Amazon CloudFront', 'Amazon Route 53', 'AWS API Gateway', 'Amazon ECS', 'Amazon EKS', 'Serverless Computing', 'Auto Scaling', 'Cloud Security', 'Infrastructure as Code', 'Terraform',
  'DevOps', 'Jenkins', 'Ansible', 'Prometheus', 'Grafana', 'Monitoring', 'Logging', 'Container Orchestration', 'CI/CD', 'Infrastructure as Code',
  'Cybersecurity', 'Information Security', 'Network Security', 'Application Security', 'Cloud Security', 'Cryptography', 'Encryption', 'Decryption', 'Hashing', 'AES', 'DES', 'RSA', 'SHA', 'Digital Signature', 'Digital Certificate', 'Public Key Infrastructure (PKI)', 'Authentication', 'Authorization', 'Ethical Hacking', 'Penetration Testing', 'Vulnerability Assessment', 'Malware Analysis', 'Digital Forensics', 'Phishing', 'Social Engineering', 'SQL Injection', 'Cross-Site Scripting (XSS)', 'Cross-Site Request Forgery (CSRF)', 'DDoS', 'Zero Trust Security', 'SIEM', 'Security Operations Center (SOC)', 'Intrusion Detection', 'Intrusion Prevention',
  'Blockchain', 'Blockchain Technology', 'Bitcoin', 'Ethereum', 'Smart Contracts', 'Cryptocurrency', 'Consensus Algorithms', 'Proof of Work', 'Proof of Stake', 'Decentralized Applications (DApps)', 'Web3', 'Distributed Ledger Technology', 'Digital Wallet', 'NFT', 'DAO', 'Web3.js', 'Ethers.js', 'Hardhat',
  'IoT', 'Internet of Things', 'Sensors', 'Actuators', 'Arduino', 'Raspberry Pi', 'ESP32', 'Embedded Systems', 'MQTT', 'IoT Security', 'Edge Computing', 'Fog Computing', 'Smart Home', 'Industrial IoT',
  'Computer Graphics', '2D Graphics', '3D Graphics', 'Rendering', 'Rasterization', 'Ray Tracing', 'OpenGL', 'DirectX', 'Lighting', 'Shading', 'Texture Mapping', 'Transformations', 'Animation', 'Game Development', 'Unity', 'Unreal Engine',
  'Parallel Computing', 'Parallel Algorithms', 'GPU Computing', 'CUDA', 'OpenMP', 'MPI', 'Distributed Computing', 'High Performance Computing',
  'Information Retrieval', 'Boolean Model', 'Vector Space Model', 'Probabilistic Model', 'Relevance Feedback', 'Search Engine', 'Web Crawling', 'Indexing', 'Ranking', 'PageRank', 'Multimedia Retrieval', 'Cross-Language Information Retrieval',
  'Mobile Application Development', 'Android Development', 'iOS Development', 'Mobile UI', 'Mobile App Architecture',
  'Business Mathematics', 'Business Statistics', 'Financial Mathematics', 'Calculus', 'Linear Algebra', 'Matrices', 'Optimization', 'Operations Research', 'Linear Programming', 'Integer Programming', 'Transportation Problem', 'Assignment Problem', 'Game Theory', 'Queuing Theory', 'Decision Theory',
  'Accounting', 'Financial Accounting', 'Cost Accounting', 'Management Accounting', 'Corporate Accounting', 'Taxation', 'Auditing', 'Financial Statements', 'Balance Sheet', 'Income Statement', 'Cash Flow Statement', 'Ratio Analysis', 'Budgeting', 'Capital Budgeting',
  'Finance', 'Financial Management', 'Corporate Finance', 'Investment Management', 'Portfolio Management', 'Risk Management', 'Financial Modelling', 'Financial Analysis', 'Capital Structure', 'Working Capital Management', 'Time Value of Money', 'Net Present Value (NPV)', 'Internal Rate of Return (IRR)', 'Weighted Average Cost of Capital (WACC)', 'Derivatives', 'Futures', 'Options', 'Hedging', 'Mergers and Acquisitions', 'Company Valuation', 'Investment Banking',
  'Marketing', 'Marketing Management', 'Digital Marketing', 'Search Engine Optimization (SEO)', 'Search Engine Marketing (SEM)', 'Social Media Marketing', 'Content Marketing', 'Email Marketing', 'Affiliate Marketing', 'Influencer Marketing', 'Brand Management', 'Consumer Behaviour', 'Market Research', 'Product Management', 'Sales Management', 'Customer Relationship Management (CRM)', 'Pricing Strategy', 'Marketing Analytics', 'Customer Segmentation', 'Conversion Rate Optimization',
  'Human Resource Management', 'Recruitment', 'Talent Acquisition', 'Talent Management', 'Performance Management', 'Compensation Management', 'Training and Development', 'Employee Engagement', 'Organizational Behaviour', 'Leadership', 'Workforce Planning', 'HR Analytics', 'Industrial Relations', 'Labour Laws',
  'Operations Management', 'Supply Chain Management', 'Logistics', 'Inventory Management', 'Production Planning', 'Quality Management', 'Six Sigma', 'Lean Management', 'Total Quality Management', 'Demand Forecasting', 'Demand Planning', 'Procurement', 'Warehouse Management',
  'Business Analytics', 'Business Intelligence', 'Advanced Excel', 'Power BI', 'Tableau', 'Predictive Analytics', 'Prescriptive Analytics', 'Descriptive Analytics', 'Diagnostic Analytics', 'Dashboard Development', 'Data Modelling',
  'Strategic Management', 'Business Policy', 'Competitive Strategy', 'Corporate Strategy', 'SWOT Analysis', 'PESTLE Analysis', 'Porter\'s Five Forces', 'Business Model Canvas', 'Strategic Planning', 'Decision Making', 'Risk Management', 'Change Management', 'Innovation Management', 'Entrepreneurship', 'Startup Management', 'Project Management', 'Stakeholder Management',
  'Economics', 'Microeconomics', 'Macroeconomics', 'Managerial Economics', 'Demand and Supply', 'Market Structures', 'Perfect Competition', 'Monopoly', 'Oligopoly', 'Inflation', 'GDP', 'Fiscal Policy', 'Monetary Policy', 'International Trade', 'Foreign Exchange', 'Balance of Payments',
  'Business Law', 'Contract Law', 'Company Law', 'Corporate Law', 'Intellectual Property Rights', 'Copyright', 'Patent', 'Trademark', 'Consumer Protection', 'Cyber Law', 'Labour Law', 'Tax Law', 'Data Protection', 'Corporate Governance',
  'Nursing Fundamentals', 'Anatomy', 'Physiology', 'Biochemistry', 'Microbiology', 'Pathology', 'Pharmacology', 'Nutrition', 'Psychology', 'Sociology', 'First Aid', 'Patient Care', 'Health Assessment', 'Nursing Ethics', 'Nursing Administration', 'Nursing Research', 'Community Health Nursing', 'Medical-Surgical Nursing', 'Child Health Nursing', 'Pediatric Nursing', 'Mental Health Nursing', 'Psychiatric Nursing', 'Maternal Health Nursing', 'Obstetric Nursing', 'Gynecological Nursing', 'Geriatric Nursing', 'Critical Care Nursing', 'Emergency Nursing', 'ICU Nursing', 'Cardiac Nursing', 'Oncology Nursing', 'Neurological Nursing', 'Renal Nursing', 'Respiratory Nursing', 'Neonatal Nursing', 'Trauma Nursing', 'Community Medicine', 'Epidemiology', 'Biostatistics', 'Infection Control', 'Patient Safety', 'Clinical Research', 'Evidence-Based Practice', 'Health Informatics', 'Telemedicine', 'Electronic Health Records', 'Medical Coding', 'Healthcare Data Analytics', 'Medical IoT', 'AI in Healthcare', 'Medical Imaging', 'Digital Health', 'Clinical Decision Support', 'Patient Monitoring', 'ECG', 'CPR', 'Basic Life Support (BLS)', 'Advanced Cardiovascular Life Support (ACLS)', 'Ventilator Management', 'Hemodynamic Monitoring', 'IV Therapy', 'Blood Transfusion', 'Medication Administration', 'Pain Management', 'Wound Care', 'Sepsis Management',
  'Research Methodology', 'Research Design', 'Literature Review', 'Research Paper', 'Technical Writing', 'Citation', 'Plagiarism', 'Hypothesis', 'Research Variables', 'Sampling', 'Qualitative Research', 'Quantitative Research', 'Experimental Research', 'Statistical Analysis', 'Data Collection', 'Data Analysis', 'Academic Writing',
  'Mathematics', 'Differential Calculus', 'Integral Calculus', 'Differential Equations', 'Numerical Methods', 'Complex Numbers', 'Optimization', 'Business Statistics', 'Financial Mathematics', 'Matrices', 'Linear Algebra', 'Calculus', 'Business Analytics', 'Advanced Excel', 'Power BI', 'Tableau', 'Digital Marketing', 'SEO', 'Content Marketing', 'Social Media Marketing', 'Google Analytics', 'Product Management', 'Project Management', 'Leadership', 'Technical Writing', 'Academic Writing'
])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

function getInitialPage() {
  const page = new URLSearchParams(window.location.search).get('page');
  return persistentPages.includes(page) ? page : null;
}

function App() {
  const [skills, setSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [peopleDirectory, setPeopleDirectory] = useState([]);
  const [category, setCategory] = useState('All');
    const [search, setSearch] = useState('');
  const [teachQuery, setTeachQuery] = useState('');
  const [wantsQuery, setWantsQuery] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState('');
  const [level, setLevel] = useState('');
  const [availability, setAvailability] = useState('');
    const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [activePage, setActivePage] = useState(getInitialPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('skillswap-theme') === 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem('skillswap-accent') || 'lime');
  const [language, setLanguage] = useState(() => localStorage.getItem('skillswap-language') || 'en');
  const [currentUser, setCurrentUser] = useState(() => { const storedUser = JSON.parse(localStorage.getItem('skillswap-user') || 'null'); const sessionToken = localStorage.getItem('skillswap-session-token'); return storedUser && sessionToken ? storedUser : null; });
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('skillswap-admin-key') || import.meta.env.VITE_ADMIN_KEY || '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(() => localStorage.getItem('skillswap-notifications-read') === 'true');
  const [savedSkills, setSavedSkills] = useState(() => JSON.parse(localStorage.getItem('skillswap-saved-skills') || '[]'));
  const [savedPeople, setSavedPeople] = useState(() => JSON.parse(localStorage.getItem('skillswap-saved-people') || '[]'));
  const [savedStories, setSavedStories] = useState(() => JSON.parse(localStorage.getItem('skillswap-saved-stories') || '[]'));
  const [toast, setToast] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('skillswap-onboarding-done') !== 'true');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [platformStatus, setPlatformStatus] = useState({ maintenanceMode: false, registrationEnabled: true, announcement: { enabled: false, title: '', message: '' } });

  useEffect(() => {
    getPlatformStatus().then(setPlatformStatus).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('skillswap-theme', darkMode ? 'dark' : 'light');
    document.documentElement.dataset.accent = accent;
    localStorage.setItem('skillswap-accent', accent);
    document.documentElement.lang = language;
    localStorage.setItem('skillswap-language', language);
  }, [darkMode, accent, language]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activePage) url.searchParams.set('page', activePage);
    else url.searchParams.delete('page');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activePage]);

  useEffect(() => {
    if (activeModal === 'login' || activeModal === 'account-community' || activeModal === 'account-advanced' || activeModal === 'admin-dashboard') setMobileOpen(false);
  }, [activeModal]);

  useEffect(() => {
    if (!adminKey) {
      localStorage.removeItem('skillswap-admin-key');
      return;
    }
    localStorage.setItem('skillswap-admin-key', adminKey);
  }, [adminKey]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleOutsideNavigationClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.main-nav') || target.closest('.menu-toggle') || target.closest('.notification-popover')) return;
      setMobileOpen(false);
      setAccountOpen(false);
    };

    document.addEventListener('click', handleOutsideNavigationClick);
    return () => document.removeEventListener('click', handleOutsideNavigationClick);
  }, [mobileOpen]);

  useEffect(() => {
    const nav = document.querySelector('.main-nav');
    if (!nav) return undefined;
    const handleCommunityClick = (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const isCommunity = ['Community', 'Comunidad', 'समुदाय'].some((label) => button.textContent.includes(label));
      const isLogin = button.classList.contains('login-link') || button.textContent.includes('Log in');
      const isAdvanced = ['Advanced', 'Avanzado', 'एडवांस्ड'].some((label) => button.textContent.includes(label));
      if (!isCommunity && !isLogin && !isAdvanced) return;
      window.setTimeout(() => {
        setMobileOpen(false);
        setActiveModal(null);
        window.setTimeout(() => setActiveModal(isLogin ? 'login' : isAdvanced ? 'account-advanced' : 'account-community'), 0);
      }, 0);
    };
    nav.addEventListener('click', handleCommunityClick);
    return () => nav.removeEventListener('click', handleCommunityClick);
  }, [language]);

  useEffect(() => {
    const cta = document.querySelector('.main-nav .nav-cta');
    if (!cta) return undefined;
    const textNode = [...cta.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = 'Sign in ';
    cta.setAttribute('aria-label', 'Sign in');
    const handleSignIn = () => {
      setMobileOpen(false);
      setActiveModal(null);
      window.setTimeout(() => setActiveModal('profile'), 0);
    };
    cta.addEventListener('click', handleSignIn);
    return () => cta.removeEventListener('click', handleSignIn);
  }, [activeModal, currentUser, language]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const fields = [...document.querySelectorAll('input[type="password"]')]
      .map((input) => {
        const form = input.closest('form');
        if (!form) return null;
        const toggle = document.createElement('button');
        toggle.className = 'password-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Show password');
        toggle.setAttribute('title', 'Show password');
        toggle.textContent = '◉';
        input.classList.add('password-input');
        form.classList.add('password-form');
        form.insertBefore(toggle, input.nextSibling);
        const position = () => { const field = input.closest('label') || input; toggle.style.top = `${field.offsetTop + (field.offsetHeight / 2) - 14}px`; };
        position();
        const update = () => {
          const visible = input.type === 'text';
          toggle.textContent = visible ? '◉' : '◉';
          toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
          toggle.setAttribute('title', visible ? 'Hide password' : 'Show password');
        };
        toggle.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; update(); input.focus(); });
        window.addEventListener('resize', position);
        return { input, form, toggle, position };
      })
      .filter(Boolean);
    return () => fields.forEach(({ input, form, toggle, position }) => { toggle.remove(); input.classList.remove('password-input'); form.classList.remove('password-form'); window.removeEventListener('resize', position); });
  }, [activeModal, currentUser]);

  useEffect(() => localStorage.setItem('skillswap-saved-skills', JSON.stringify(savedSkills)), [savedSkills]);
  useEffect(() => localStorage.setItem('skillswap-saved-people', JSON.stringify(savedPeople)), [savedPeople]);
  useEffect(() => localStorage.setItem('skillswap-saved-stories', JSON.stringify(savedStories)), [savedStories]);

  const toggleSavedSkill = (skill) => setSavedSkills((current) => current.some((item) => item._id === skill._id) ? current.filter((item) => item._id !== skill._id) : [skill, ...current]);
  const toggleSavedWithToast = (skill) => { const saved = savedSkills.some((item) => item._id === skill._id); toggleSavedSkill(skill); setToast(saved ? 'Removed from saved skills.' : 'Saved skill for later.'); };
  const openMessage = (recipient) => { if (!currentUser) { setToast('Log in to message another member.'); setActiveModal('login'); return; } const avatar = recipient.avatar || peopleDirectory.find((person) => (recipient.email && person.email === recipient.email) || person.name === recipient.name)?.avatar || allSkills.find((skill) => (recipient.email && skill.teacher.email === recipient.email) || skill.teacher.name === recipient.name)?.teacher.avatar || ''; setMessageRecipient({ ...recipient, avatar }); setActiveModal('contact'); };
  const openNotification = (notification) => { setNotificationOpen(false); if (notification.type !== 'message') return; setMessageRecipient({ name: notification.senderName || notification.title.replace(/ sent you a message$/, ''), email: notification.senderEmail || '' }); setActiveModal('account-messages'); if (currentUser?.email) markNotificationsRead(currentUser.email).then(() => setNotificationHistory((items) => items.map((item) => ({ ...item, read: true })))); };
  const labels = language === 'hi' ? { explore: 'कौशल खोजें', people: 'लोग खोजें', community: 'समुदाय', advanced: 'एडवांस्ड' } : language === 'es' ? { explore: 'Explorar habilidades', people: 'Encontrar personas', community: 'Comunidad', advanced: 'Avanzado' } : { explore: 'Explore skills', people: 'Find people', community: 'Community', advanced: 'Advanced' };

  useEffect(() => { setPage(1); }, [category, search, teachQuery, wantsQuery, location, format, level, availability, sort]);
  useEffect(() => { let cancelled = false; setSkillsLoading(true); setSkillsError(''); getSkills({ category, search, teach: teachQuery, wants: wantsQuery, location, format, level, availability, sort, page, limit: 8 }).then((result) => { if (!cancelled) { setSkills((current) => page === 1 ? result.items : [...current, ...result.items]); setHasMore(result.hasMore); } }).catch(() => { if (!cancelled) { setSkills([]); setSkillsError('We could not load the exchange board.'); } }).finally(() => { if (!cancelled) setSkillsLoading(false); }); return () => { cancelled = true; }; }, [category, search, teachQuery, wantsQuery, location, format, level, availability, sort, page]);
  useEffect(() => { getSkills({ category: 'All', search: '', page: 1, limit: 24 }).then((result) => setAllSkills(result.items)).catch(() => setAllSkills([])); }, []);
  useEffect(() => { getPeople().then((profiles) => setPeopleDirectory(profiles.map((profile) => ({ ...profile, role: profile.teaches?.[0] || 'Community member', city: profile.location || 'Location not shared', skills: profile.teaches?.join(' · ') || 'Learning in public', wants: profile.wants?.join(' · ') || 'Open to a useful exchange', initials: profile.name?.slice(0, 2).toUpperCase(), color: '#dbe8de', rating: profile.rating || 0, exchanges: profile.exchanges || 0, responseTime: 'Replies when available', availability: 'Flexible', format: 'Flexible', verified: profile.emailVerified || profile.verified, lastActive: 'Recently joined' })))).catch(() => setPeopleDirectory([])); }, []);
  useEffect(() => { if (!currentUser?.email) return undefined; getMessages(currentUser.email).then((items) => setUnreadMessages(items.filter((item) => !item.read && item.recipientEmail === currentUser.email).length)).catch(() => setUnreadMessages(0)); getNotifications(currentUser.email).then(setNotificationHistory).catch(() => setNotificationHistory([])); return undefined; }, [currentUser?.email]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const closeAccountMenu = (event) => {
      if (!event.target.closest('.user-menu')) setAccountOpen(false);
    };
    document.addEventListener('click', closeAccountMenu);
    return () => document.removeEventListener('click', closeAccountMenu);
  }, [accountOpen]);
  useEffect(() => {
    if (!notificationOpen) return undefined;
    const closeNotifications = (event) => {
      if (!event.target.closest('.notification-popover') && !event.target.closest('.notification-button')) setNotificationOpen(false);
    };
    document.addEventListener('mousedown', closeNotifications);
    return () => document.removeEventListener('mousedown', closeNotifications);
  }, [notificationOpen]);

  const sortedSkills = [...skills].sort((first, second) => sort === 'rating' ? second.teacher.rating - first.teacher.rating : sort === 'newest' ? String(second._id).localeCompare(String(first._id)) : sort === 'nearby' && location ? Number(second.teacher.location.toLowerCase().includes(location.toLowerCase())) - Number(first.teacher.location.toLowerCase().includes(location.toLowerCase())) : 0);
  const recommendedSkills = currentUser?.wants?.length ? allSkills.filter((skill) => currentUser.wants.some((want) => `${skill.title} ${skill.category} ${skill.wants}`.toLowerCase().includes(want.toLowerCase()))).slice(0, 3) : [];
  const similarPeople = peopleDirectory;
  const suggestedPeople = peopleDirectory.filter((person) => person.email !== currentUser?.email && person._id !== currentUser?._id).slice(0, 3);

  const scrollTo = (id) => {
    setActiveModal(null);
    setMobileOpen(false);

    if (id === 'top' && activePage) {
      window.requestAnimationFrame(() => {
        const dedicatedPage = document.querySelector('.dedicated-page');
        if (dedicatedPage) {
          dedicatedPage.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      return;
    }

    setActivePage(null);
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
  };

  const verificationToken = new URLSearchParams(window.location.search).get('verify');
  const resetToken = new URLSearchParams(window.location.search).get('reset');
  if (verificationToken) return <VerificationGate token={verificationToken} />;
  if (resetToken) return <ResetPasswordGate token={resetToken} />;
  if (!currentUser) return <AuthGate onLogin={(user) => { setCurrentUser(user); localStorage.setItem('skillswap-user', JSON.stringify(user)); }} />;

  return <><div className={darkMode ? 'app-shell dark-mode' : 'app-shell'}>
    {platformStatus.maintenanceMode && <div className="platform-banner maintenance"><strong>Maintenance mode</strong><span>SkillSwap is temporarily under maintenance. Some account features may be unavailable.</span></div>}
    {!platformStatus.maintenanceMode && platformStatus.announcement?.enabled && platformStatus.announcement?.message && <div className="platform-banner"><strong>{platformStatus.announcement.title || 'SkillSwap announcement'}</strong><span>{platformStatus.announcement.message}</span></div>}
    <header className="site-header">
      <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); setActivePage(null); setActiveModal(null); setMobileOpen(false); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); }}><span className="brand-mark"><ArrowLeftRight size={17} strokeWidth={2.4} /></span> skillswap</a>
      <button className="menu-toggle" onClick={(event) => { event.stopPropagation(); setMobileOpen((open) => !open); }} aria-label="Toggle navigation">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <nav className={mobileOpen ? 'main-nav open' : 'main-nav'}>
        <button onClick={() => { setActivePage('explore'); setActiveModal(null); setMobileOpen(false); }}>{labels.explore}</button><button onClick={() => { setActivePage('people'); setActiveModal(null); setMobileOpen(false); }}>{labels.people}</button><button onClick={() => { setActivePage('how'); setActiveModal(null); setMobileOpen(false); }}>How it works</button><button onClick={() => { setActivePage('stories'); setActiveModal(null); setMobileOpen(false); }}>Stories</button><button onClick={() => { setActivePage('community'); setActiveModal(null); setMobileOpen(false); }}>{labels.community}</button><button onClick={() => { setActivePage('advanced'); setActiveModal(null); setMobileOpen(false); }}><Sparkles size={14} /> {labels.advanced}</button>
        <button className={darkMode ? 'theme-toggle is-dark' : 'theme-toggle'} onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}><Moon className="theme-moon" size={14} /><span className="theme-knob"></span><Sun className="theme-sun" size={14} /></button>
        {currentUser ? <div className="user-menu"><button className="user-menu-trigger" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>{currentUser.avatar ? <img className="nav-avatar" src={currentUser.avatar} alt="" /> : <span className="nav-avatar nav-avatar-fallback">{currentUser.name?.slice(0, 2).toUpperCase()}</span>}<span className="signed-in-user">{currentUser.name}</span><ChevronDown size={14} /></button>{accountOpen && <div className="user-dropdown"><button onClick={() => { setActiveModal('account-profile'); setAccountOpen(false); }}><UserRound size={14} /> My profile</button><button onClick={() => { setActiveModal('account-messages'); setAccountOpen(false); }}><MessageCircle size={14} /> Messages {unreadMessages > 0 && <span className="menu-count">{unreadMessages}</span>}</button><button onClick={() => { setActiveModal('account-exchanges'); setAccountOpen(false); }}><Repeat2 size={14} /> My exchanges</button><button onClick={() => { setActiveModal('account-saved'); setAccountOpen(false); }}><Bookmark size={14} /> Saved skills</button><button onClick={() => { setActiveModal('account-settings'); setAccountOpen(false); }}><Settings size={14} /> Settings</button><button onClick={() => { setActiveModal('account-password'); setAccountOpen(false); }}><Settings size={14} /> Change password</button><button onClick={() => { setActiveModal('account-safety'); setAccountOpen(false); }}><ShieldCheck size={14} /> Trust & safety</button><button className="logout-item" onClick={() => { localStorage.removeItem('skillswap-user'); localStorage.removeItem('skillswap-session-token'); setCurrentUser(null); setAccountOpen(false); }}> Log out</button></div>}</div> : <button className="login-link" onClick={() => setActiveModal('login')}>Log in</button>}
        {currentUser && <button className="notification-button" onClick={() => setNotificationOpen(!notificationOpen)} aria-label="Notifications" aria-expanded={notificationOpen}><Bell size={17} />{notificationHistory.filter((item) => !item.read).length > 0 && <span>{notificationHistory.filter((item) => !item.read).length}</span>}</button>}
        {!currentUser && <button className="nav-cta" onClick={() => setActiveModal('profile')}>Create a profile </button>}
      </nav>
    </header>

    {activePage && <DedicatedPage page={activePage} currentUser={currentUser} skills={sortedSkills} similarPeople={similarPeople} peopleDirectory={peopleDirectory} savedStories={savedStories} onSaveStory={(story) => setSavedStories((items) => items.some((item) => item.id === story.id) ? items.filter((item) => item.id !== story.id) : [story, ...items])} onStoryDetails={setSelectedStory} search={search} setSearch={setSearch} category={category} setCategory={setCategory} sort={sort} setSort={setSort} teachQuery={teachQuery} setTeachQuery={setTeachQuery} wantsQuery={wantsQuery} setWantsQuery={setWantsQuery} location={location} setLocation={setLocation} format={format} setFormat={setFormat} level={level} setLevel={setLevel} availability={availability} setAvailability={setAvailability} savedSkills={savedSkills} savedPeople={savedPeople} onSave={toggleSavedWithToast} onSavePerson={(person) => setSavedPeople((items) => items.some((item) => item.name === person.name) ? items.filter((item) => item.name !== person.name) : [person, ...items])} onDetails={setSelectedSkill} onPersonDetails={setSelectedPerson} onClose={() => setActivePage(null)} onConnect={openMessage} />}
    <main id="top" className={activePage ? 'home-content-hidden' : ''}>
      <section className="hero section-pad">
        <div className="hero-copy reveal"><div className="eyebrow"><Sparkles size={15} /> skills worth sharing</div><h1>Trade what you know.<br /><em>Grow together.</em></h1><p className="hero-text">A community where your skills become someone else’s next chapter — and theirs become yours.</p><div className="hero-actions"><button className="button button-dark" onClick={() => scrollTo('explore')}>Explore the exchange </button><button className="text-button" onClick={() => scrollTo('how')}>See how it works <span>↓</span></button></div><div className="proof"><div className="avatar-stack"><span>MC</span><span>LO</span><span>AM</span><span>+</span></div><div><strong>2,400+ exchanges</strong><small>made with good intentions</small></div></div></div>
        <div className="hero-art reveal-delay exchange-visual">
          <div className="visual-grid"></div>
          <div className="visual-header"><span className="live-dot"></span> live exchange <span>04 / 12</span></div>
          <div className="exchange-card teach-card"><div className="card-kicker">A member offers</div><div className="visual-avatar avatar-peach">SK</div><strong>A practical skill</strong><small>Ready for a thoughtful swap</small><div className="skill-pill">Community</div></div>
          <div className="swap-connector"><span>↔</span><small>matched</small></div>
          <div className="exchange-card learn-card"><div className="card-kicker">A member is looking for</div><div className="visual-avatar avatar-blue">SK</div><strong>A useful new skill</strong><small>Beginner friendly</small><div className="skill-pill">Learning</div></div>
          <div className="visual-footer"><span>community powered</span><span className="sparkle-mark">✦</span><span>no money needed</span></div>
        </div>
      </section>

      <section className="ticker"><div>learn something new</div><span>✦</span><div>share what you know</div><span>✦</span><div>make a good trade</div><span>✦</span><div>learn something new</div></section>

      <section className="section-pad explore-section" id="explore"><div className="section-heading"><div><div className="eyebrow">the exchange board</div><h2>Find your next <em>good trade.</em></h2></div><button className="text-button" onClick={() => setCategory('All')}>View all skills </button></div><div className="explore-toolbar"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-box"><Search size={17} /><input aria-label="Search skills" placeholder="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="sort-select">Sort<select aria-label="Sort skills" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Relevance</option><option value="rating">Top rated</option><option value="newest">Newest</option></select></label></div><div className="discovery-filters"><input aria-label="I teach" placeholder="I teach..." value={teachQuery} onChange={(event) => setTeachQuery(event.target.value)} /><input aria-label="I want to learn" placeholder="I want to learn..." value={wantsQuery} onChange={(event) => setWantsQuery(event.target.value)} /><input aria-label="Location" placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} /><select aria-label="Format" value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Any format</option><option>Online</option><option>Video call</option><option>In person</option></select><select aria-label="Skill level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Any level</option><option>Beginner friendly</option><option>Intermediate</option><option>Advanced</option><option>All levels</option></select><select aria-label="Availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option>Weekdays</option><option>Weekends</option><option>Flexible</option></select></div>{skillsLoading && page === 1 ? <SkillSkeletons /> : skillsError ? <ErrorState message={skillsError} onRetry={() => setPage(1)} /> : sortedSkills.length ? <><div className="skill-grid">{sortedSkills.map((skill) => <SkillCard key={skill._id || skill.title} skill={skill} saved={savedSkills.some((item) => item._id === skill._id)} onSave={() => { toggleSavedWithToast(skill); }} onConnect={() => openMessage({ name: skill.teacher.name, email: skill.teacher.email || '' })} />)}</div>{hasMore && <button className="load-more-button" onClick={() => setPage((current) => current + 1)}>Load more skills <ArrowDown size={16} /></button>}</> : <EmptyState />}</section>

      {recommendedSkills.length > 0 && <section className="recommendation-section section-pad"><div className="eyebrow">picked for your profile</div><h2>Recommended <em>good trades.</em></h2><div className="recommendation-grid">{recommendedSkills.map((skill) => <SkillCard key={skill._id} skill={skill} saved={savedSkills.some((item) => item._id === skill._id)} onSave={() => toggleSavedWithToast(skill)} onConnect={() => openMessage({ name: skill.teacher.name, email: skill.teacher.email || '' })} />)}</div></section>}

      <section className="people-band section-pad" id="people"><div className="section-heading"><div><div className="eyebrow">people behind the skills</div><h2>{currentUser ? 'Suggested people.' : 'Good at something?'}<br /><em>Meet your people.</em></h2></div>{currentUser ? <button className="button button-light" onClick={() => { setActivePage('people'); setMobileOpen(false); }}>View all people </button> : <button className="button button-light" onClick={() => setActiveModal('profile')}>Join the community </button>}</div><div className="people-grid">{suggestedPeople.map((person) => <div className="person-card" key={person._id || person.email || person.name}><div className="person-avatar" style={{ background: person.color }}>{person.initials}</div><div className="person-info"><h3>{person.name}</h3><p>{person.role}</p><small>{person.city}</small><div className="person-skills">{person.skills.split(' · ').map((skill) => <span key={skill}>{skill}</span>)}</div></div></div>)}</div></section>

      <section className="how-section section-pad" id="how"><div className="section-heading centered"><div><div className="eyebrow">no awkward barter math</div><h2>Three steps to a <em>better exchange.</em></h2></div></div><div className="steps"><Step number="01" title="Put it out there" text="Tell the community what you know, and what you are curious to learn next." /><Step number="02" title="Find the spark" text="Browse real people and specific skills until something clicks." /><Step number="03" title="Make the trade" text="Agree on a format, swap time and leave a little better than you arrived." /></div></section>

      <section className="story-section section-pad" id="stories"><div className="story-quote">“I came for one useful skill.<br /><em>I stayed for the community.</em>”</div><div className="story-footer"><div className="story-person"><div className="mini-avatar">SK</div><div><strong>Community member</strong><small>Real exchanges, real people</small></div></div><div className="story-count"><strong>1</strong><span>good exchange<br />at a time</span></div></div></section>
    </main>

    <footer className="footer section-pad"><div className="brand footer-brand"><span className="brand-mark"><ArrowLeftRight size={17} strokeWidth={2.4} /></span> skillswap</div><p>Skill is more valuable when it moves.</p><div className="footer-links"><button onClick={() => setActiveModal('contact')}>Contact</button><button onClick={() => scrollTo('how')}>How it works</button>{!currentUser && <button onClick={() => setActiveModal('profile')}>Create profile</button>}</div></footer>
    <button className="back-to-top" onClick={() => scrollTo('top')} aria-label="Back to top" title="Back to top"><ArrowUp size={18} /></button>
    {notificationOpen && <NotificationsPanel notifications={notificationHistory} onNotificationClick={openNotification} onMarkRead={() => { setNotificationsRead(true); if (currentUser?.email) markNotificationsRead(currentUser.email).then(() => setNotificationHistory((items) => items.map((item) => ({ ...item, read: true })))); setNotificationOpen(false); }} onClose={() => setNotificationOpen(false)} />}
    {showOnboarding && <OnboardingPanel onDone={() => { localStorage.setItem('skillswap-onboarding-done', 'true'); setShowOnboarding(false); }} />}
    {toast && <div className="toast" role="status"><Check size={15} /> {toast}</div>}
    {selectedSkill && <SkillDetailPanel skill={selectedSkill} currentUser={currentUser} onClose={() => setSelectedSkill(null)} onConnect={openMessage} onOffer={() => { setSelectedSkill(null); setActiveModal(currentUser ? 'account-edit' : 'profile'); }} />}
    {selectedPerson && <PeopleProfilePanel person={selectedPerson} onClose={() => setSelectedPerson(null)} onMessage={() => openMessage({ name: selectedPerson.name, email: selectedPerson.email || '' })} onOffer={() => { setSelectedPerson(null); setActiveModal(currentUser ? 'account-edit' : 'profile'); }} />}
    {selectedStory && <StoryDetailPanel story={selectedStory} onClose={() => setSelectedStory(null)} onStart={() => { setSelectedStory(null); setActivePage('people'); }} />}
    {activeModal === 'account-advanced' && <AdvancedPanel user={currentUser} onClose={() => setActiveModal(null)} onSaved={(user) => { setCurrentUser(user); localStorage.setItem('skillswap-user', JSON.stringify(user)); }} />}
    {activeModal === 'owner-login' && <OwnerAccessGate adminKey={adminKey} setAdminKey={setAdminKey} onOpenDashboard={() => setActiveModal('admin-dashboard')} onClose={() => setActiveModal(null)} />}
    {activeModal === 'admin-dashboard' && <AdminDashboardPanel adminKey={adminKey} setAdminKey={setAdminKey} onClose={() => setActiveModal(null)} />}
    {activeModal && !['owner-login', 'admin-dashboard'].includes(activeModal) && (activeModal === 'account-edit' ? <EditProfilePanelEnhanced user={currentUser} onClose={() => setActiveModal(null)} onSaved={(user) => { setCurrentUser(user); localStorage.setItem('skillswap-user', JSON.stringify(user)); setActiveModal('account-profile'); }} /> : activeModal === 'account-community' ? <CommunityPanel user={currentUser} onClose={() => setActiveModal(null)} /> : activeModal === 'account-password' ? <PasswordPanel email={currentUser?.email} onClose={() => setActiveModal(null)} /> : activeModal === 'account-safety' ? <SafetyPanel user={currentUser} onClose={() => setActiveModal(null)} onDeleted={() => { localStorage.removeItem('skillswap-user'); localStorage.removeItem('skillswap-session-token'); setCurrentUser(null); setActiveModal(null); }} /> : activeModal === 'account-exchanges' ? <ExchangesPanel user={currentUser} onClose={() => setActiveModal(null)} onOpenMessages={(recipient) => { setMessageRecipient(recipient); setActiveModal('account-messages'); }} /> : activeModal === 'account-messages' ? <MessagesPanel user={currentUser} initialRecipient={messageRecipient} onClose={() => setActiveModal(null)} /> : activeModal === 'account-saved' ? <SavedSkillsPanel skills={allSkills} savedSkills={savedSkills} onToggle={toggleSavedSkill} onConnect={openMessage} onClose={() => setActiveModal(null)} /> : activeModal === 'account-settings' ? <SettingsPanel darkMode={darkMode} setDarkMode={setDarkMode} accent={accent} setAccent={setAccent} language={language} setLanguage={setLanguage} onPassword={() => setActiveModal('account-password')} onClose={() => setActiveModal(null)} /> : activeModal.startsWith('account-') ? <AccountPanelEnhanced section={activeModal.replace('account-', '')} user={currentUser} onClose={() => setActiveModal(null)} onEdit={() => setActiveModal('account-edit')} /> : <Modal type={activeModal} recipient={messageRecipient} sender={currentUser} onClose={() => { setActiveModal(null); setStatus(''); }} status={status} setStatus={setStatus} onLogin={(user) => { setCurrentUser(user); localStorage.setItem('skillswap-user', JSON.stringify(user)); }} />)}
  </div></>;
}

function AuthGate({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', teaches: '', wants: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  useEffect(() => { const signupTab = document.querySelector('.auth-tabs button:nth-child(2)'); if (signupTab) signupTab.textContent = 'Sign up'; }, [mode]);
  const switchMode = (nextMode) => { setMode(nextMode); setForm({ name: '', email: '', password: '', teaches: '', wants: '' }); setError(''); setResetStatus(''); setResetLink(''); };
  const resendVerification = async () => {
    const email = verificationEmail.trim();
    if (!email) { setVerificationStatus('Please enter a valid email.'); return; }
    setVerificationLoading(true);
    setVerificationStatus('');
    try {
      const result = await sendVerification(email);
      setVerificationStatus(result.message || 'Verification link sent.');
    } catch (requestError) {
      setVerificationStatus(requestError.message || 'Could not send verification link.');
    } finally {
      setVerificationLoading(false);
    }
  };
  const openVerification = () => {
    setVerificationEmail(form.email.trim());
    setVerificationStatus('');
    setVerificationOpen(true);
  };
  const requestReset = async () => {
    if (!resetEmail.trim()) { setResetStatus('Please enter a valid email.'); return; }
    setResetLink('');
    setResetLoading(true);
    try {
      const result = await forgotPassword(resetEmail.trim());
      setResetStatus(result.message);
      if (result.developmentToken) {
        const resetUrl = `${window.location.origin}${window.location.pathname}?reset=${encodeURIComponent(result.developmentToken)}`;
        setResetLink(resetUrl);
        window.location.assign(resetUrl);
      }
    } catch (requestError) {
      setResetStatus(requestError.message || 'Could not start password reset.');
    } finally {
      setResetLoading(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await createProfile({ ...form, teaches: form.teaches ? [form.teaches] : [], wants: form.wants ? [form.wants] : [] });
        setNotice(`${result.message} ${result.developmentToken ? `Development token: ${result.developmentToken}` : ''}`);
        setMode('login');
        setForm({ name: '', email: form.email, password: '', teaches: '', wants: '' });
      } else {
        const result = await loginProfile({ email: form.email, password: form.password });
        onLogin(result.profile);
      }
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const signupTab = document.querySelector('.auth-tabs button:nth-child(2)'); if (signupTab) signupTab.textContent = 'Sign up'; }, [mode]);
  return <><div className="auth-gate"><div className="auth-panel"><div className="auth-brand"><span className="brand-mark"><ArrowLeftRight size={17} strokeWidth={2.4} /></span><strong>skillswap</strong></div><div className="auth-layout"><div className="auth-intro"><div className="eyebrow"><Sparkles size={14} /> skills worth sharing</div><h1>Trade what you know.<br /><em>Grow together.</em></h1><p>Join a community where every useful skill can become someone else’s next chapter.</p><div className="auth-proof"><span>2,400+</span><small>good exchanges already moving</small></div></div><div className={`auth-card ${mode === 'signup' ? 'signup-mode' : 'login-mode'}`}><div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign in</button></div><div className="eyebrow">{mode === 'login' ? 'welcome back' : 'make your move'}</div><h2>{mode === 'login' ? 'Log in to SkillSwap.' : 'Create your profile.'}</h2><p>{mode === 'login' ? 'Pick up where your next good exchange left off.' : 'Put one skill on the table and meet your next exchange partner.'}</p><form onSubmit={submit}>{mode === 'signup' && <input required placeholder="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}<input required type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><PasswordInput required minLength={mode === 'signup' ? 8 : undefined} placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />{mode === 'signup' && <><SkillPicker label="What can you teach?" value={form.teaches} onChange={(value) => setForm({ ...form, teaches: value })} placeholder="Select a skill you teach" /><SkillPicker label="What do you want to learn?" value={form.wants} onChange={(value) => setForm({ ...form, wants: value })} placeholder="Select a skill you want to learn" /></>}{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}<button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create profile'} </button></form>{mode === 'login' && <div className="auth-account-actions">
  <button type="button" className="forgot-password-link" onClick={() => { setResetEmail(form.email); setResetOpen(true); setError(''); }} disabled={loading}>Forgot password?</button>
  <button type="button" className="resend-verification-link" onClick={openVerification} disabled={loading}>Resend verification
  </button>
</div>}

<small className="auth-privacy">Your profile stays yours. No money, no pressure, just useful exchanges.</small></div></div></div></div>{verificationOpen && <div className="modal-backdrop reset-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setVerificationOpen(false)} onClick={(event) => event.stopPropagation()}><div className="modal-panel reset-panel verification-resend-panel" role="dialog" aria-modal="true" aria-labelledby="resend-verification-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setVerificationOpen(false)} aria-label="Close"><X size={19} /></button><div className="eyebrow">email verification</div><h2 id="resend-verification-title">Resend verification link.</h2><p>Enter your account email and we will send a fresh verification link.</p>{verificationStatus && <p className="reset-result" role="status">{verificationStatus}</p>}<form onSubmit={(event) => { event.preventDefault(); resendVerification(); }}><input required type="email" autoFocus placeholder="Email address" value={verificationEmail} onChange={(event) => setVerificationEmail(event.target.value)} /><button className="button button-dark" type="submit" disabled={verificationLoading}>{verificationLoading ? 'Sending...' : 'Send verification link'} </button></form></div></div>}{resetOpen && <div className="modal-backdrop reset-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setResetOpen(false)} onClick={(event) => event.stopPropagation()}><div className="modal-panel reset-panel" role="dialog" aria-modal="true" aria-labelledby="reset-password-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setResetOpen(false)} aria-label="Close"><X size={19} /></button><div className="eyebrow">account recovery</div><h2 id="reset-password-title">Reset your password.</h2><p>Enter your account email and we will send a secure reset link.</p>{resetStatus && <p className="reset-result" role="alert">{resetStatus}</p>}<form onSubmit={(event) => { event.preventDefault(); requestReset(); }}><input required type="email" autoFocus placeholder="Email address" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} /><button className="button button-dark" type="submit" disabled={resetLoading}>{resetLoading ? 'Sending...' : 'Send reset link'} </button></form></div></div>}</>;
}

function VerificationGate({ token }) {
  const [status, setStatus] = useState('Verifying your email...');
  useEffect(() => { verifyEmail(token).then((result) => { setStatus(result.message); window.history.replaceState({}, '', window.location.pathname); }).catch((error) => setStatus(error.message)); }, [token]);
  return <div className="auth-gate"><div className="auth-card verification-card"><div className="account-panel-icon"><Check size={23} /></div><div className="eyebrow">email verification</div><h2>{status}</h2><p>Your SkillSwap account will be available after verification.</p><a className="button button-dark" href={window.location.pathname}>Continue to SkillSwap </a></div></div>;
}

function ResetPasswordGate({ token }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setStatus(''); try { const result = await resetPassword({ token, newPassword: password }); setStatus(result.message); window.history.replaceState({}, '', window.location.pathname); } catch (error) { setStatus(error.message); } finally { setSaving(false); } };
  return <div className="auth-gate"><div className="auth-card verification-card"><div className="account-panel-icon"><ShieldCheck size={23} /></div><div className="eyebrow">account recovery</div><h2>Choose a new password.</h2><p>Use at least 8 characters for your new SkillSwap password.</p><form onSubmit={submit}><PasswordInput required minLength={8} placeholder="New password (8+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="button button-dark auth-submit" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save new password'} <Check size={16} /></button></form>{status && <p className="auth-notice" role="status">{status}</p>}</div></div>;
}

function PasswordInput({ value, onChange, ...props }) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input-shell"><input {...props} type={visible ? 'text' : 'password'} value={value} onChange={onChange} /><button type="button" className="password-icon-button" aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>;
}

function SkillPicker({ value, onChange, label, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const searchRef = useRef(null);
  const options = skillOptions.filter((skill) => !query.trim() || skill.toLowerCase().includes(query.toLowerCase().trim()));
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);
  return <label ref={pickerRef} className="skill-picker"><span className="skill-picker-label">{label}</span><div className={`skill-picker-field ${open ? 'is-open' : ''}`}><button type="button" className="skill-picker-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((current) => !current); window.setTimeout(() => searchRef.current?.focus(), 0); }}>{value || placeholder}<ChevronDown size={16} /></button>{open && <div className="skill-picker-menu"><div className="skill-picker-search"><Search size={15} /><input ref={searchRef} type="search" value={query} placeholder="Search skills" aria-label={`Search ${label}`} onChange={(event) => setQuery(event.target.value)} /></div><div className="skill-picker-options" role="listbox" aria-label={label}>{options.map((skill) => <button type="button" role="option" aria-selected={value === skill} className={value === skill ? 'selected' : ''} key={skill} onClick={() => { onChange(skill); setOpen(false); setQuery(''); }}>{skill}</button>)}{options.length === 0 && <span className="skill-picker-empty">No skills found</span>}</div></div>}</div></label>;
}

function SkillCard({ skill, saved, onSave, onConnect, onDetails }) { const teacherAvatar = skill.teacher.avatar; return <article className="skill-card" onClick={(event) => { if (!event.target.closest('button')) onDetails?.(); }}><div className="card-top" style={{ background: skill.color }}><span className="card-category">{skill.category}</span><button className="save-skill-button" onClick={onSave} aria-label={saved ? `Remove ${skill.title} from saved skills` : `Save ${skill.title}`} title={saved ? 'Remove saved skill' : 'Save skill'}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button><button className="round-arrow" onClick={onConnect} aria-label={`Connect with ${skill.teacher.name}`}></button><div className="skill-glyph">{skill.title.charAt(0)}</div></div><div className="card-body"><div className="card-title-row"><h3>{skill.title}</h3><div className="rating"><Star size={13} fill="currentColor" /> {skill.teacher.rating} <small>{skill.teacher.exchanges || 0} swaps</small></div></div><p>{skill.description}</p><div className="card-meta"><span>{skill.level}</span><span>{skill.format}</span></div><div className="trade-row"><div className="teacher"><span className="tiny-avatar">{teacherAvatar?.startsWith('data:image/') ? <img src={teacherAvatar} alt="" /> : teacherAvatar}</span><span><strong>{skill.teacher.name}</strong><small>{skill.teacher.role}</small><small className="teacher-location">{skill.teacher.location || 'Community member'}</small></span></div><span className="trade-icon">↔</span><span className="wants"><small>Wants to learn</small>{skill.wants}</span></div></div></article>; }
function SkillSkeletons() { return <div className="skill-grid" aria-label="Loading skills">{[1, 2, 3, 4].map((item) => <div className="skill-skeleton" key={item}><div className="skeleton-top"></div><div className="skeleton-line long"></div><div className="skeleton-line"></div><div className="skeleton-line short"></div></div>)}</div>; }
function ErrorState({ message, onRetry }) { return <div className="state-panel error-state" role="alert"><XCircle size={30} /><strong>{message}</strong><p>Check that the API is running, then try again.</p><button className="button button-dark" onClick={onRetry}>Try again</button></div>; }
function EmptyState() { return <div className="state-panel"><Search size={30} /><strong>No matching skills</strong><p>Try a different keyword or choose another category.</p></div>; }
function Step({ number, title, text }) { return <div className="step"><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p><span className="step-line"></span></div>; }

function AccountPanel({ section, user, onClose, onEdit }) { const content = { exchanges: ['My exchanges', 'Your active and completed skill swaps will appear here.'], saved: ['Saved skills', 'Save interesting skills from the exchange board to find them quickly later.'], settings: ['Settings', 'Manage your account preferences and privacy here.'] }[section]; const teachSkills = user?.teaches?.filter(Boolean) || []; const learnSkills = user?.wants?.filter(Boolean) || []; return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel account-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{section === 'profile' ? <><div className="profile-heading"><span className="profile-avatar">{user?.name?.slice(0, 2).toUpperCase()}</span><div><div className="eyebrow">your profile</div><h2>{user?.name}</h2><small>{user?.email}</small></div></div><div className="profile-about"><span className="profile-label">about you</span><p>{user?.bio || 'Tell the community what makes your skills and perspective useful.'}</p></div><div className="profile-columns"><div><span className="profile-label">i can teach</span><div className="profile-tags">{teachSkills.length ? teachSkills.map((skill) => <span key={skill}>{skill}</span>) : <span className="empty-tag">Add a skill</span>}</div></div><div><span className="profile-label">i want to learn</span><div className="profile-tags">{learnSkills.length ? learnSkills.map((skill) => <span key={skill}>{skill}</span>) : <span className="empty-tag">Add a goal</span>}</div></div></div><button className="button button-dark" onClick={onEdit}>Edit profile </button></> : <><div className="account-panel-icon"><UserRound size={23} /></div><div className="eyebrow">your account</div><h2>{content[0]}</h2><p>{content[1]}</p><div className="account-summary"><span className="account-summary-avatar">{user?.name?.slice(0, 2).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div></div><button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></>}</div></div>; }

function EditProfilePanel({ user, onClose, onSaved }) { const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', location: user?.location || '', bio: user?.bio || '', teaches: (user?.teaches || []).join(', '), wants: (user?.wants || []).join(', ') }); const [error, setError] = useState(''); const submit = async (event) => { event.preventDefault(); try { const updated = await updateProfile(user._id, { ...form, teaches: form.teaches.split(',').map((skill) => skill.trim()).filter(Boolean), wants: form.wants.split(',').map((skill) => skill.trim()).filter(Boolean) }); onSaved(updated); } catch (requestError) { setError(requestError.message); } }; return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel edit-profile-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">edit your profile</div><h2>Make it more you.</h2><p>Keep your exchange profile current so the right people can find you.</p><form onSubmit={submit}><input required value={form.name} placeholder="Your name" onChange={(event) => setForm({ ...form, name: event.target.value })} /><input required type="email" value={form.email} placeholder="Email address" onChange={(event) => setForm({ ...form, email: event.target.value })} /><input value={form.location} placeholder="Location" onChange={(event) => setForm({ ...form, location: event.target.value })} /><textarea value={form.bio} rows="3" placeholder="Short bio" onChange={(event) => setForm({ ...form, bio: event.target.value })}></textarea><input value={form.teaches} placeholder="Skills you teach, separated by commas" onChange={(event) => setForm({ ...form, teaches: event.target.value })} /><input value={form.wants} placeholder="Skills you want to learn, separated by commas" onChange={(event) => setForm({ ...form, wants: event.target.value })} />{error && <p className="form-error">{error}</p>}<button className="button button-dark" type="submit">Save changes <Check size={16} /></button></form></div></div>; }

function Modal({ type, recipient, sender, onClose, status, setStatus, onLogin }) { const isProfile = type === 'profile'; const isLogin = type === 'login'; const isContact = type === 'contact'; const [form, setForm] = useState({}); const submit = async (event) => { event.preventDefault(); try { if (isProfile) await createProfile(form); else if (isLogin) { const result = await loginProfile(form); onLogin(result.profile); } else if (isContact) { if (!sender) throw new Error('Please log in before messaging another member.'); await sendMessage({ senderName: sender.name, senderEmail: sender.email, recipientName: recipient?.name || 'SkillSwap member', recipientEmail: recipient?.email || '', message: form.message }); } setStatus(isProfile ? 'Profile saved. Welcome to the exchange.' : isLogin ? 'Welcome back to SkillSwap.' : 'Message sent to your exchange partner.'); } catch (error) { setStatus(error.message || 'Something went wrong. Please try again.'); } }; return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{status ? <div className="success-state"><div className="success-icon"><Check size={22} /></div><h2>{status}</h2><button className="button button-dark" onClick={onClose}>Close</button></div> : <><div className="eyebrow">{isProfile ? 'make your move' : isLogin ? 'welcome back' : 'say hello'}</div><h2>{isProfile ? 'Create your profile.' : isLogin ? 'Log in to SkillSwap.' : `Message ${recipient?.name || 'this member'}.`}</h2><p>{isProfile ? 'Put one skill on the table. You never know who has the thing you need.' : isLogin ? 'Pick up where your next good exchange left off.' : `Start a direct conversation with ${recipient?.name || 'your exchange partner'}.`}</p><form onSubmit={submit}>{isProfile ? <><input required placeholder="Your name" onChange={(e) => setForm({ ...form, name: e.target.value })} /><input required type="email" placeholder="Email address" onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required type="password" minLength="8" placeholder="Password (8+ characters)" onChange={(e) => setForm({ ...form, password: e.target.value })} /><input placeholder="What can you teach?" onChange={(e) => setForm({ ...form, teaches: [e.target.value] })} /><input placeholder="What do you want to learn?" onChange={(e) => setForm({ ...form, wants: [e.target.value] })} /></> : isLogin ? <><input required type="email" placeholder="Email address" onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></> : <textarea required placeholder="Write your message" rows="5" onChange={(e) => setForm({ ...form, message: e.target.value })}></textarea>}<button className="button button-dark" type="submit">{isProfile ? 'Create profile' : isLogin ? 'Log in' : 'Send message'} </button></form></>}</div></div>; }

function OwnerAccessGate({ adminKey, setAdminKey, onOpenDashboard, onClose }) {
  const [entry, setEntry] = useState(adminKey || '');
  const [error, setError] = useState('');

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel admin-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">owner access</div><h2>Owner login</h2><p>Enter the owner key to unlock the user directory and management tools.</p><label className="settings-select admin-key-row"><span>Admin key</span><input value={entry} onChange={(event) => setEntry(event.target.value)} aria-label="Admin key" type="password" placeholder="Owner key" /></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark" onClick={() => {
    const nextKey = entry.trim();
    if (!nextKey) {
      setError('Please enter the owner key.');
      return;
    }
    setAdminKey(nextKey);
    setError('');
    onOpenDashboard();
  }}>Open owner dashboard</button></div></div>;
}

function AdminDashboardPanel({ adminKey, setAdminKey, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeUser, setNoticeUser] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    let cancelled = false;
    setLoading(true);
    getAdminUsers(adminKey)
      .then((items) => {
        if (!cancelled) setUsers(Array.isArray(items) ? items : []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || 'Could not load the owner dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  };

  useEffect(() => {
    if (!adminKey) return undefined;
    return loadUsers();
  }, [adminKey]);

  const showNotice = (message, userId = '') => {
    setNotice(message);
    setNoticeUser(userId);
    window.setTimeout(() => setNotice(''), 5000);
  };

  const updateUser = async (user, updates) => {
    if (!adminKey) return;
    setSaving(true);
    try {
      if (updates.verified === true && !(user.emailVerified || user.verified)) {
        const userId = user._id || user.email;
        showNotice('Sending verification link...', userId);
        const result = await sendAdminVerification(adminKey, userId);
        const successMessage = result.developmentToken ? `Verification link sent successfully. Token: ${result.developmentToken}` : 'Verification link sent successfully.';
        showNotice(successMessage, userId);
        return;
      }
      const updated = await updateAdminUser(adminKey, user._id || user.email, updates);
      setUsers((current) => current.map((item) => (item._id === updated._id || item.email === updated.email ? { ...item, ...updated } : item)));
      setError('');
    } catch (requestError) {
      showNotice(requestError.message || 'Could not update this user.', user._id || user.email);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    if (!adminKey || !window.confirm(`Delete ${user.name || user.email}? This action cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteAdminUser(adminKey, user._id || user.email);
      setUsers((current) => current.filter((item) => !(item._id === user._id || item.email === user.email)));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this user.');
    } finally {
      setSaving(false);
    }
  };

  const summary = {
    total: users.length,
    verified: users.filter((user) => user.emailVerified || user.verified).length,
    hidden: users.filter((user) => user.profileVisible === false).length,
    blocked: users.filter((user) => user.allowMessages === false).length
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel admin-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">owner access</div><div className="admin-panel-header"><div><h2>All user details.</h2><p>Review the full user directory, update records, and restrict or remove risky accounts.</p></div><button className="button button-light admin-refresh-button" onClick={loadUsers} disabled={loading}>Refresh</button></div><div className="admin-summary"><div className="admin-summary-card"><span>Total users</span><strong>{summary.total}</strong></div><div className="admin-summary-card"><span>Verified</span><strong>{summary.verified}</strong></div><div className="admin-summary-card"><span>Hidden profiles</span><strong>{summary.hidden}</strong></div><div className="admin-summary-card"><span>Blocked messaging</span><strong>{summary.blocked}</strong></div></div><label className="settings-select admin-key-row"><span>Admin key</span><input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} aria-label="Admin key" type="password" /></label>{loading ? <div className="empty-exchanges"><strong>Loading users...</strong></div> : error ? <div className="empty-exchanges"><strong>{error}</strong></div> : <div className="admin-user-list">{users.length ? users.map((user) => { const userId = user._id || user.email; return <div className="admin-user-card" key={userId}><div className="admin-user-head"><span className="profile-avatar">{(user.name || user.email || 'U').slice(0, 2).toUpperCase()}</span><div><strong>{user.name || 'Unnamed member'}</strong><small>{user.email}</small></div></div><div className="admin-user-meta"><span><b>Location</b>{user.location || 'Not shared'}</span><span><b>Verified</b>{user.emailVerified || user.verified ? 'Yes' : 'No'}</span><span><b>Privacy</b>{user.profileVisible === false ? 'Hidden' : 'Visible'}</span><span><b>Messages</b>{user.allowMessages === false ? 'Blocked' : 'Allowed'}</span><span><b>Skills</b>{user.teaches?.length ? user.teaches.join(', ') : 'No skill list'}</span><span><b>Wants</b>{user.wants?.length ? user.wants.join(', ') : 'No learning goals'}</span></div>{notice && noticeUser === userId && <div className="admin-notice" role="status">{notice}<button type="button" aria-label="Close notification" onClick={() => setNotice('')}><X size={14} /></button></div>}<div className="admin-user-actions"><button className="button button-light" onClick={() => updateUser(user, { verified: !(user.emailVerified || user.verified) })} disabled={saving}>{(user.emailVerified || user.verified) ? 'Mark unverified' : 'Verify user'}</button><button className="button button-light" onClick={() => updateUser(user, { profileVisible: user.profileVisible === false })} disabled={saving}>{user.profileVisible === false ? 'Show profile' : 'Hide profile'}</button><button className="button button-light" onClick={() => updateUser(user, { allowMessages: user.allowMessages === false })} disabled={saving}>{user.allowMessages === false ? 'Allow messages' : 'Block messages'}</button><button className="button button-light danger-button" onClick={() => deleteUser(user)} disabled={saving}>Delete</button></div></div>; }) : <div className="empty-exchanges"><strong>No users found.</strong></div>}</div>}</div></div>;
}

function AccountPanelEnhanced({ section, user, onClose, onEdit }) {
  const content = {
    exchanges: ['My exchanges', 'Your active and completed skill swaps will appear here.'],
    saved: ['Saved skills', 'Save interesting skills from the exchange board to find them quickly later.'],
    settings: ['Settings', 'Manage your account preferences and privacy here.'],
    advanced: ['Advanced workspace', 'Use your learning profile to find better exchanges.']
  }[section];
  const avatar = user?.avatar ? <img src={user.avatar} alt="Profile" /> : user?.name?.slice(0, 2).toUpperCase();
  const completion = Math.round(([user?.name, user?.email, user?.avatar, user?.bio, user?.location, user?.teaches?.length, user?.wants?.length].filter(Boolean).length / 7) * 100);

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className={`modal-panel account-panel ${section === 'profile' ? 'profile-view' : ''}`}>
    <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
    {section === 'profile' ? <>
      <div className="profile-heading"><span className="profile-avatar">{avatar}</span><div><div className="eyebrow">your profile</div><h2>{user?.name} {user?.verified && <span className="verified-badge" title="Verified profile">✓</span>}</h2><span className="credential-label">login credential</span><small>{user?.email}</small>{user?.rating > 0 && <small className="profile-rating"><Star size={12} fill="currentColor" /> {user.rating} · {user.reviewCount || 0} reviews</small>}</div></div>
      <div className="profile-about"><span className="profile-label">about you</span><p>{user?.bio || 'Tell the community what makes your skills and perspective useful.'}</p></div>
      <div className="profile-columns"><div><span className="profile-label">i can teach</span><div className="profile-tags">{user?.teaches?.length ? user.teaches.map((skill) => <span key={skill}>{skill}</span>) : <span className="empty-tag">Add a skill</span>}</div></div><div><span className="profile-label">i want to learn</span><div className="profile-tags">{user?.wants?.length ? user.wants.map((skill) => <span key={skill}>{skill}</span>) : <span className="empty-tag">Add a goal</span>}</div></div></div>
      <div className="completion-block"><div><span>Profile completion</span><strong>{completion}%</strong></div><div className="completion-track"><span style={{ width: `${completion}%` }}></span></div></div><button className="button button-dark" onClick={onEdit}>Edit profile </button>
    </> : <><div className="account-panel-icon"><UserRound size={23} /></div><div className="eyebrow">your account</div><h2>{content[0]}</h2><p>{content[1]}</p><div className="account-summary"><span className="account-summary-avatar">{avatar}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div></div><button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></>}
  </div></div>;
}

function EditProfilePanelEnhanced({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', location: user?.location || '', bio: user?.bio || '', teaches: (user?.teaches || []).join(', '), wants: (user?.wants || []).join(', ') });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [error, setError] = useState('');
  const handleAvatar = (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Profile picture must be smaller than 2MB.'); return; } const reader = new FileReader(); reader.onload = () => setAvatarPreview(reader.result); reader.readAsDataURL(file); };
  const submit = async (event) => { event.preventDefault(); if (!localStorage.getItem('skillswap-session-token')) { setError('Your login session has expired. Please log in again before saving changes.'); return; } try { const updated = await updateProfile(user._id || user.email, { ...form, avatar: avatarPreview, teaches: form.teaches.split(',').map((skill) => skill.trim()).filter(Boolean), wants: form.wants.split(',').map((skill) => skill.trim()).filter(Boolean) }); onSaved(updated); } catch (requestError) { setError(requestError.message || 'Could not save your profile. Please log in again and try once more.'); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel edit-profile-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">edit your profile</div><h2>Make it more you.</h2><p>Keep your exchange profile current so the right people can find you.</p><form onSubmit={submit}><label className="avatar-upload"><span className="upload-avatar">{avatarPreview ? <img src={avatarPreview} alt="Selected profile" /> : user?.name?.slice(0, 2).toUpperCase()}</span><span><strong>Profile picture</strong><small>JPG, PNG or WebP · max 2MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} /></label><input required value={form.name} placeholder="Your name" onChange={(event) => setForm({ ...form, name: event.target.value })} /><input required type="email" value={form.email} readOnly aria-readonly="true" title="Login email cannot be edited" placeholder="Email address" /><input value={form.location} placeholder="Location" onChange={(event) => setForm({ ...form, location: event.target.value })} /><textarea value={form.bio} rows="3" placeholder="Short bio" onChange={(event) => setForm({ ...form, bio: event.target.value })}></textarea><SkillPicker label="What can you teach?" value={form.teaches} onChange={(value) => setForm({ ...form, teaches: value })} placeholder="Select a skill you teach" /><SkillPicker label="What do you want to learn?" value={form.wants} onChange={(value) => setForm({ ...form, wants: value })} placeholder="Select a skill you want to learn" />{error && <p className="form-error">{error}</p>}<button className="button button-dark" type="submit">Save changes <Check size={16} /></button></form></div></div>;
}

function ExchangesPanel({ user, onClose, onOpenMessages }) {
  return <RealExchangesPanel user={user} onClose={onClose} onOpenMessages={onOpenMessages} />;
  const [tab, setTab] = useState('active');
  const [pending, setPending] = useState(true);
  const [active, setActive] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel exchanges-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">your exchange desk</div><h2>My exchanges.</h2><p>Keep every skill swap moving in the right direction.</p><div className="exchange-tabs">{[['active', 'Active', 1], ['pending', 'Pending', pending ? 1 : 0], ['completed', 'Completed', 0]].map(([value, label, count]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}<span>{count}</span></button>)}</div>{tab === 'active' && active && <div className="exchange-item"><div className="exchange-item-top"><span className="status-pill status-active"><CheckCircle2 size={13} /> In progress</span><span className="exchange-date">Next: Sat, 7:00 PM</span></div><div className="exchange-match"><div className="exchange-person exchange-you"><span>{user?.name?.slice(0, 2).toUpperCase()}</span><strong>{user?.teaches?.[0] || 'Your skill'}</strong><small>You teach</small></div><div className="exchange-line"><Repeat2 size={19} /><small>good trade</small></div><div className="exchange-person"><span className="exchange-avatar-blue">AM</span><strong>Python</strong><small>Arjun teaches</small></div></div><div className="exchange-actions"><button onClick={() => {}}><MessageCircle size={15} /> Open chat</button><button onClick={() => setActive(false)}><Check size={15} /> Mark complete</button></div></div>}{tab === 'pending' && pending && <div className="exchange-item"><div className="exchange-item-top"><span className="status-pill status-pending"><Clock3 size={13} /> Awaiting response</span><span className="exchange-date">Received today</span></div><div className="pending-copy"><strong>Maya wants to learn {user?.teaches?.[0] || 'your skill'}</strong><p>She can trade conversational Spanish in return.</p></div><div className="exchange-actions"><button className="accept-action" onClick={() => { setPending(false); setTab('active'); }}><Check size={15} /> Accept request</button><button onClick={() => setPending(false)}><XCircle size={15} /> Decline</button></div></div>}{tab === 'completed' && <div className="empty-exchanges"><CheckCircle2 size={30} /><strong>No completed exchanges yet</strong><p>Your finished swaps and ratings will appear here.</p></div>}{tab === 'active' && !active && <div className="empty-exchanges"><CheckCircle2 size={30} /><strong>Exchange completed</strong><p>Nice work. Add a rating from your exchange history soon.</p><button className="button button-dark">Rate exchange <Star size={15} /></button></div>}</div></div>;
}

function RealExchangesPanel({ user, onClose, onOpenMessages }) {
  const [tab, setTab] = useState('active');
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user?.email) return undefined;
    let cancelled = false;
    setLoading(true);
    getExchanges(user.email).then((items) => { if (!cancelled) setExchanges(Array.isArray(items) ? items : []); }).catch((requestError) => { if (!cancelled) setError(requestError.message || 'Could not load exchanges.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.email]);
  const rows = exchanges.map((exchange) => {
    const isRequester = exchange.requesterEmail?.toLowerCase() === normalizedEmail;
    return { ...exchange, participantName: isRequester ? exchange.ownerName : exchange.requesterName, participantEmail: isRequester ? exchange.ownerEmail : exchange.requesterEmail, ownSkill: isRequester ? exchange.requesterSkill : exchange.ownerSkill, participantSkill: isRequester ? exchange.ownerSkill : exchange.requesterSkill };
  });
  const visible = rows.filter((exchange) => tab === 'active' ? ['active', 'accepted', 'in-progress', 'in_progress'].includes(exchange.status) : tab === 'pending' ? exchange.status === 'pending' : ['completed', 'complete'].includes(exchange.status));
  const openChat = (exchange) => { if (!exchange.participantEmail) return; onOpenMessages({ name: exchange.participantName || exchange.participantEmail, email: exchange.participantEmail }); };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel exchanges-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">your exchange desk</div><h2>My exchanges.</h2><p>Keep every skill swap moving in the right direction.</p><div className="exchange-tabs">{[['active', 'Active'], ['pending', 'Pending'], ['completed', 'Completed']].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}<span>{rows.filter((exchange) => value === 'active' ? ['active', 'accepted', 'in-progress', 'in_progress'].includes(exchange.status) : value === 'pending' ? exchange.status === 'pending' : ['completed', 'complete'].includes(exchange.status)).length}</span></button>)}</div>{loading ? <div className="empty-exchanges"><strong>Loading exchanges...</strong></div> : error ? <div className="empty-exchanges"><strong>{error}</strong></div> : visible.length ? visible.map((exchange) => <div className="exchange-item" key={exchange._id}><div className="exchange-item-top"><span className={`status-pill ${exchange.status === 'pending' ? 'status-pending' : 'status-active'}`}><CheckCircle2 size={13} /> {exchange.status}</span>{exchange.scheduledAt && <span className="exchange-date">{new Date(exchange.scheduledAt).toLocaleString()}</span>}</div><div className="exchange-match"><div className="exchange-person exchange-you"><span>{user?.name?.slice(0, 2).toUpperCase()}</span><strong>{exchange.ownSkill || 'Skill exchange'}</strong><small>You offer</small></div><div className="exchange-line"><Repeat2 size={19} /><small>good trade</small></div><div className="exchange-person"><span className="exchange-avatar-blue">{exchange.participantName?.slice(0, 2).toUpperCase() || '--'}</span><strong>{exchange.participantSkill || 'Skill exchange'}</strong><small>{exchange.participantName || exchange.participantEmail}</small></div></div><div className="exchange-actions"><button onClick={() => openChat(exchange)}><MessageCircle size={15} /> Open chat</button>{!['completed', 'complete'].includes(exchange.status) && <button onClick={() => updateExchange(exchange._id, 'completed').then((updated) => setExchanges((items) => items.map((item) => item._id === updated._id ? updated : item))).catch(() => setError('Could not update this exchange.'))}><Check size={15} /> Mark complete</button>}</div></div>) : <div className="empty-exchanges"><CheckCircle2 size={30} /><strong>No {tab} exchanges yet</strong><p>Verified member exchanges will appear here once they are created.</p></div>}<button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

function SavedSkillsPanel({ skills, savedSkills, onToggle, onConnect, onClose }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.toLowerCase().trim();
  const filtered = skills.filter((skill) => { const matches = skill.wants.toLowerCase().includes(normalizedQuery); return matches && (normalizedQuery || savedSkills.some((item) => item._id === skill._id)); });
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel saved-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">your shortlist</div><h2>Saved skills.</h2><p>{normalizedQuery ? 'Search the full exchange board and save something new.' : 'Keep the exchanges that caught your attention close by.'}</p><label className="search-box saved-search"><Search size={16} /><input placeholder="Search any skill" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{filtered.length ? <div className="saved-list">{filtered.map((skill) => { const isSaved = savedSkills.some((item) => item._id === skill._id); return <div className="saved-item" key={skill._id}><div className="saved-item-icon" style={{ background: skill.color }}>{skill.title.charAt(0)}</div><div className="saved-item-copy"><strong>{skill.title}</strong><small>{skill.teacher.name} · {skill.category}</small></div><button className="saved-connect" onClick={() => onConnect({ name: skill.teacher.name, email: skill.teacher.email || '' })}>Start exchange</button><button className={isSaved ? 'saved-remove' : 'saved-add'} onClick={() => onToggle(skill)} aria-label={isSaved ? `Remove ${skill.title}` : `Save ${skill.title}`}>{isSaved ? <X size={15} /> : <Bookmark size={15} />}</button></div>; })}</div> : <div className="empty-exchanges saved-empty"><Bookmark size={30} /><strong>{normalizedQuery ? 'No matching skill found' : 'No saved skills yet'}</strong><p>{normalizedQuery ? 'Try another keyword, category or teacher name.' : 'Search any skill above or bookmark one from the exchange board.'}</p></div>}<button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

function SettingsPanel({ darkMode, setDarkMode, accent, setAccent, onPassword, onClose }) {
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem('skillswap-settings') || '{"profileVisible":true,"messages":true,"requests":true,"reminders":true,"format":"Online","availability":"Weekends"}'));
  const update = (key, value) => setSettings((current) => { const next = { ...current, [key]: value }; localStorage.setItem('skillswap-settings', JSON.stringify(next)); return next; });
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel settings-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">your preferences</div><h2>Settings.</h2><p>Shape how you learn, share and stay in touch.</p><div className="settings-section"><span className="settings-heading">Privacy</span><SettingToggle label="Profile visible to community" checked={settings.profileVisible} onChange={(value) => update('profileVisible', value)} /><SettingToggle label="Allow direct messages" checked={settings.messages} onChange={(value) => update('messages', value)} /></div><div className="settings-section"><span className="settings-heading">Notifications</span><SettingToggle label="Exchange requests" checked={settings.requests} onChange={(value) => update('requests', value)} /><SettingToggle label="Session reminders" checked={settings.reminders} onChange={(value) => update('reminders', value)} /></div><div className="settings-section"><span className="settings-heading">Exchange preferences</span><label className="settings-select">Preferred format<select value={settings.format} onChange={(event) => update('format', event.target.value)}><option>Online</option><option>In person</option><option>Both</option></select></label><label className="settings-select">Availability<select value={settings.availability} onChange={(event) => update('availability', event.target.value)}><option>Weekdays</option><option>Weekends</option><option>Flexible</option></select></label></div><div className="settings-section"><span className="settings-heading">Appearance</span><SettingToggle label="Dark mode" checked={darkMode} onChange={setDarkMode} /><label className="settings-select">Accent theme<select value={accent} onChange={(event) => setAccent(event.target.value)}><option value="lime">Lime</option><option value="coral">Coral</option><option value="sky">Sky</option></select></label></div><button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

function SettingToggle({ label, checked, onChange }) { return <label className="setting-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-track"><span></span></span></label>; }

function PasswordPanel({ email, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [status, setStatus] = useState('');
  const submit = async (event) => { event.preventDefault(); try { const result = await changePassword({ email, ...form }); setStatus(result.message); } catch (error) { setStatus(error.message); } };
  const requestReset = async () => { try { const result = await forgotPassword(email); setStatus(result.developmentToken ? `${result.message} Dev token: ${result.developmentToken}` : result.message); } catch (error) { setStatus(error.message); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel password-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">account security</div><h2>Change password.</h2><p>Your login email is <strong>{email}</strong>. It cannot be edited here.</p><form onSubmit={submit}><input required type="password" placeholder="Current password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /><input required minLength="8" type="password" placeholder="New password (8+ characters)" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /><button className="button button-dark" type="submit">Save password <Check size={16} /></button></form><button className="forgot-password" onClick={requestReset}>Forgot password? Send reset instructions</button>{status && <p className="password-status" role="status">{status}</p>}</div></div>;
}

function OnboardingPanel({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [['Offer a skill', 'Put something you know on the exchange board.'], ['Find your match', 'Search for people who want to learn it and offer something you want in return.'], ['Make the trade', 'Message your match, schedule a session and grow together.']];
  return <div className="modal-backdrop onboarding-backdrop"><div className="modal-panel onboarding-panel"><div className="onboarding-mark"><ArrowLeftRight size={25} /></div><div className="eyebrow">welcome to skillswap</div><h2>{steps[step][0]}.</h2><p>{steps[step][1]}</p><div className="onboarding-progress">{steps.map((_, index) => <span className={index <= step ? 'active' : ''} key={index}></span>)}</div><div className="onboarding-actions">{step > 0 && <button className="text-button" onClick={() => setStep((value) => value - 1)}>Back</button>}<button className="button button-dark" onClick={() => step === steps.length - 1 ? onDone() : setStep((value) => value + 1)}>{step === steps.length - 1 ? 'Start exploring' : 'Next'} </button></div><button className="onboarding-skip" onClick={onDone}>Skip for now</button></div></div>;
}

function SafetyPanel({ user, onClose, onDeleted }) {
  const [reportedEmail, setReportedEmail] = useState('');
  const [reason, setReason] = useState('spam');
  const [status, setStatus] = useState('');
  const verify = async () => { try { const result = await sendVerification(user.email); setStatus(result.developmentToken ? `${result.message} Token: ${result.developmentToken}` : result.message); } catch (error) { setStatus(error.message); } };
  const report = async (event) => { event.preventDefault(); try { const result = await reportUser({ reporterEmail: user.email, reportedEmail, reason }); setStatus(result.message); } catch (error) { setStatus(error.message); } };
  const block = async () => { try { const result = await blockUser({ blockerEmail: user.email, blockedEmail: reportedEmail }); setStatus(result.message); } catch (error) { setStatus(error.message); } };
  const removeAccount = async () => { if (!window.confirm('Delete your SkillSwap account permanently?')) return; try { await deleteAccount(user.email); onDeleted(); } catch (error) { setStatus(error.message); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel safety-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="account-panel-icon"><ShieldCheck size={23} /></div><div className="eyebrow">trust & safety</div><h2>Stay in control.</h2><p>Verify your email, report unsafe behavior, block accounts and manage deletion.</p><div className="safety-section"><strong>Email verification</strong><small>{user.emailVerified ? 'Your email is verified.' : 'Your email is not verified yet.'}</small>{!user.emailVerified && <button className="button button-light" onClick={verify}>Send verification</button>}</div><div className="safety-section"><strong>Report or block a user</strong><form onSubmit={report}><input required type="email" placeholder="User email" value={reportedEmail} onChange={(event) => setReportedEmail(event.target.value)} /><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="unsafe">Unsafe behavior</option><option value="other">Other</option></select><div className="safety-actions"><button className="button button-dark" type="submit">Report user</button><button className="button button-light" type="button" onClick={block}>Block user</button></div></form></div><div className="safety-section danger-zone"><strong>Delete account</strong><small>This permanently removes your profile and cannot be undone.</small><button className="danger-button" onClick={removeAccount}>Delete my account</button></div>{status && <p className="password-status" role="status">{status}</p>}<button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

function CommunityPanel({ user, onClose }) {
  const [groups, setGroups] = useState([]); const [leaders, setLeaders] = useState([]); const [joined, setJoined] = useState({}); const [room, setRoom] = useState(''); const [pendingRoom, setPendingRoom] = useState(''); const [roomCreating, setRoomCreating] = useState(false);
  useEffect(() => { getGroups().then(setGroups).catch(() => {}); getLeaderboard().then(setLeaders).catch(() => {}); }, []);
  const createRoom = async () => {
    if (roomCreating) return;
    setRoomCreating(true);
    try { const result = await createVideoRoom(); setPendingRoom(result.url); }
    catch { setRoom('Video room unavailable.'); }
    finally { setRoomCreating(false); }
  };
  const openRoom = () => { if (!pendingRoom) return; setRoom(pendingRoom); setPendingRoom(''); window.open(pendingRoom, '_blank', 'noopener,noreferrer'); };
  const cancelRoom = () => setPendingRoom('');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel community-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">the wider exchange</div><h2>Community.</h2><p>Find your circle, learn together and celebrate generous skill-sharing.</p><div className="community-section"><span className="settings-heading">Groups</span>{groups.map((group) => <div className="group-row" key={group._id}><span className="group-icon"><UsersRound size={17} /></span><span><strong>{group.name}</strong><small>{group.description}</small></span><button onClick={async () => { const updated = await joinGroup(group._id); setJoined({ ...joined, [group._id]: true }); setGroups(groups.map((item) => item._id === group._id ? updated : item)); }}>{joined[group._id] ? 'Joined' : \`Join · \${group.members}\`}</button></div>)}</div><div className="community-section"><span className="settings-heading">Leaderboard</span>{leaders.length ? leaders.slice(0, 5).map((leader, index) => <div className="leader-row" key={leader.name}><b>#{index + 1}</b><span>{leader.name}</span><small>{leader.exchanges} exchanges · {leader.rating || 'New'} rating</small></div>) : <div className="community-empty">Complete exchanges to appear here.</div>}</div><div className="community-section"><span className="settings-heading">Video room</span><p className="community-small">Create a free Jitsi room for your next exchange.</p><button className="button button-dark" onClick={createRoom} disabled={roomCreating}>{roomCreating ? 'Creating room…' : 'Create video room'} <CalendarDays size={16} /></button>{room && <a className="room-link" href={room} target="_blank" rel="noreferrer">Open meeting room</a>}{pendingRoom && <div className="video-room-permission" role="dialog" aria-modal="true" aria-labelledby="community-video-room-permission-title"><div className="video-room-permission-icon"><Video size={22} /></div><strong id="community-video-room-permission-title">Open video room?</strong><p>Your Jitsi room is ready. Do you want to open the meeting now?</p><div className="video-room-permission-actions"><button type="button" className="button button-light" onClick={cancelRoom}>Not now</button><button type="button" className="button button-dark" onClick={openRoom}>Open meeting room <ArrowUp size={14} /></button></div></div>}</div><button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

export function conversationsFromMessages(messages, userEmail) {
  const grouped = new Map();
  messages.forEach((message) => {
    const isSender = message.senderEmail === userEmail;
    const email = isSender ? message.recipientEmail : message.senderEmail;
    if (!email) return;
    const counterpartName = isSender ? (message.recipientName || message.recipientEmail || 'Direct message') : (message.senderName || message.senderEmail || 'Direct message');
    const current = grouped.get(email);
    if (!current || Date.parse(message.createdAt) > Date.parse(current.createdAt)) grouped.set(email, { id: email, email, name: counterpartName, avatar: isSender ? message.recipientAvatar : message.senderAvatar, initials: counterpartName.slice(0, 2).toUpperCase(), preview: message.message, time: new Date(message.createdAt).toLocaleDateString(), unread: !isSender && !message.read, status: 'Available', skill: 'Direct message', match: 0, exchange: 'New request', availability: 'Flexible', rating: 0, createdAt: message.createdAt });
  });
  return [...grouped.values()].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

export function chatFromMessages(messages, userEmail) {
  return [...messages].sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt)).reduce((result, message) => {
    const conversationId = message.senderEmail === userEmail ? message.recipientEmail : message.senderEmail;
    if (!conversationId) return result;
    const messagesForConversation = result[conversationId] || [];
    result[conversationId] = [...messagesForConversation, { id: message._id, from: message.senderEmail === userEmail ? 'me' : 'them', text: message.message, time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: message.senderEmail === userEmail ? (message.read ? 'Read' : 'Delivered') : message.read ? 'Read' : 'Delivered' }];
    return result;
  }, {});
}

function pendingConversation(recipient) {
  return { id: recipient.email || `person:${recipient.name}`, email: recipient.email, name: recipient.name, avatar: recipient.avatar || '', initials: recipient.name.slice(0, 2).toUpperCase(), preview: 'Open conversation', time: 'now', unread: false, status: 'Available', skill: 'Direct message', match: 0, exchange: 'New request', availability: 'Flexible', rating: 0, createdAt: new Date().toISOString() };
}

function MessageAvatar({ avatar, initials, className = 'message-avatar' }) {
  return <span className={className}>{avatar ? <img src={avatar} alt="" /> : initials}</span>;
}

function MessagesPanel({ user, onClose, initialRecipient }) {
  const [conversations, setConversations] = useState(() => initialRecipient ? [pendingConversation(initialRecipient)] : []);
  const [activeId, setActiveId] = useState(() => initialRecipient ? (initialRecipient.email || `person:${initialRecipient.name}`) : null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [chat, setChat] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const activeTypingUser = activeId ? (typingUsers[activeId] || '') : '';
  const setTyping = (value) => {
    const isTyping = Boolean(value);
    if (!user?.email || !active?.email) return;
    socketRef.current?.emit('typing', {
      senderName: user.name,
      senderEmail: user.email,
      recipientEmail: active.email,
      isTyping,
    });
  };
  const [scheduled, setScheduled] = useState(false);
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const active = conversations.find((item) => item.id === activeId) || { name: 'No conversations yet', avatar: '', initials: '--', status: 'Start an exchange to message a member', skill: 'No active exchange', match: 0, exchange: 'None', availability: 'Flexible', rating: 0 };
  const visible = conversations.filter((item) => (!query || `${item.name} ${item.preview} ${item.skill}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'all' || filter === 'unread' && item.unread || filter === 'active' && item.exchange === 'In progress' || filter === 'archived' && item.exchange === 'Archived'));
  useEffect(() => { if (!user?.email) return undefined; let cancelled = false; const syncMessages = () => getMessages(user.email).then((items) => { if (cancelled) return; const loaded = conversationsFromMessages(items, user.email); setChat(chatFromMessages(items, user.email)); const target = initialRecipient && loaded.find((item) => (initialRecipient.email && item.email === initialRecipient.email) || item.name === initialRecipient.name); if (initialRecipient) { const pending = target || pendingConversation(initialRecipient); const withoutDuplicate = loaded.filter((item) => item.id !== pending.id); setConversations([pending, ...withoutDuplicate]); setActiveId(pending.id); } else { setConversations(loaded); setActiveId((current) => current || loaded[0]?.id || null); } }).catch(() => { if (!cancelled && initialRecipient) { const pending = pendingConversation(initialRecipient); setConversations((items) => items.some((item) => item.id === pending.id) ? items : [pending, ...items]); setActiveId(pending.id); } }); syncMessages(); const pollTimer = window.setInterval(syncMessages, 2000); const socket = connectChat(user.email, (message) => { const conversationId = message.senderEmail; const incoming = { id: message._id || `live-${Date.now()}`, from: 'them', text: message.message, time: 'now', status: 'Delivered' }; setChat((items) => ({ ...items, [conversationId]: [...(items[conversationId] || []).filter((item) => item.id !== incoming.id), incoming] })); setConversations((items) => [{ id: conversationId, email: conversationId, name: message.senderName, initials: message.senderName.slice(0, 2).toUpperCase(), preview: message.message, time: 'now', unread: true, status: 'Online', skill: 'New exchange', match: 80, exchange: 'New request', availability: 'Flexible', rating: 0 }, ...items.filter((item) => item.id !== conversationId)]); }, (seen) => setChat((items) => Object.fromEntries(Object.entries(items).map(([conversationId, messages]) => [conversationId, messages.map((message) => message.id === seen.messageId ? { ...message, status: 'Read' } : message)]))), (typingEvent) => { const conversationId = typingEvent?.senderEmail || typingEvent?.conversationId; if (!conversationId) return; setTypingUsers((current) => ({ ...current, [conversationId]: typingEvent.isTyping ? (typingEvent.senderName || 'Someone') : '' })); }); socketRef.current = socket; return () => { cancelled = true; window.clearInterval(pollTimer); socketRef.current = null; socket.disconnect(); }; }, [user?.email, initialRecipient?.email, initialRecipient?.name, activeId]);
  useEffect(() => {
    const missingAvatars = conversations.filter((conversation) => conversation.email && !conversation.avatar);
    if (!missingAvatars.length) return undefined;
    let cancelled = false;
    Promise.all(missingAvatars.map(async (conversation) => {
      try { const profile = await getPublicProfile(conversation.email); return { id: conversation.id, avatar: profile.avatar || '' }; } catch { return { id: conversation.id, avatar: '' }; }
    })).then((updates) => {
      if (cancelled) return;
      setConversations((items) => items.map((conversation) => updates.find((update) => update.id === conversation.id)?.avatar ? { ...conversation, avatar: updates.find((update) => update.id === conversation.id).avatar } : conversation));
    });
    return () => { cancelled = true; };
  }, [conversations]);
  useEffect(() => { if (!activeId || !active.email || !socketRef.current) return undefined; const unread = (chat[activeId] || []).filter((message) => message.from === 'them' && message.status !== 'Read' && message.id && !String(message.id).startsWith('live-')); if (!unread.length) return undefined; setChat((items) => ({ ...items, [activeId]: (items[activeId] || []).map((message) => unread.some((item) => item.id === message.id) ? { ...message, status: 'Read' } : message) })); unread.forEach((message) => { markMessageRead(message.id).catch(() => {}); socketRef.current.emit('message-seen', { messageId: message.id, senderEmail: active.email }); }); return undefined; }, [activeId, active.email, chat]);
  const markRead = (id) => setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: false } : item));
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [activeId, chat, activeTypingUser]);
  useEffect(() => { document.documentElement.style.setProperty('--typing-user', JSON.stringify(activeTypingUser || '')); return () => document.documentElement.style.removeProperty('--typing-user'); }, [activeTypingUser]);
  const sendMessageNow = (text = draft, messageId = `local-${Date.now()}`) => { if (!text.trim()) return; setChat((items) => ({ ...items, [activeId]: [...(items[activeId] || []), { id: messageId, from: 'me', text: text.trim(), time: 'now', status: 'Delivered' }] })); setConversations((items) => items.map((item) => item.id === activeId ? { ...item, preview: text.trim(), time: 'now' } : item)); setDraft(''); };
  const sendLiveMessage = async () => { const messageText = draft.trim(); if (!messageText || !active.email) { if (!active.email) setStatus('This conversation is missing a recipient email.'); return; } try { const created = await sendMessage({ senderName: user.name, senderEmail: user.email, recipientName: active.name, recipientEmail: active.email, message: messageText }); sendMessageNow(messageText, created._id); const socket = socketRef.current || connectChat(user.email, () => {}); socket.emit('send-message', { _id: created._id, senderName: user.name, senderEmail: user.email, recipientName: active.name, recipientEmail: active.email, message: messageText }); if (!socketRef.current) socket.disconnect(); } catch (error) { setStatus(error.message || 'Could not send this message.'); } };
  const createRoom = async () => { try { const result = await createVideoRoom(); setRoom(result.url); } catch { setStatus('Video room unavailable.'); } };
  return <div className="modal-backdrop messages-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel messages-workspace" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><aside className="messages-sidebar"><div className="eyebrow">your inbox</div><h2>Messages.</h2><div className="message-search"><Search size={15} /><input aria-label="Search messages" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="message-filters">{[['all', 'All'], ['unread', 'Unread'], ['active', 'Active'], ['archived', 'Archived']].map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="conversation-list">{visible.map((conversation) => <button className={activeId === conversation.id ? 'active' : ''} key={conversation.id} onClick={() => { setActiveId(conversation.id); markRead(conversation.id); }}><MessageAvatar avatar={conversation.avatar} initials={conversation.initials} /><span className="conversation-copy"><strong>{conversation.name}</strong><small>{conversation.preview}</small><em>{conversation.time}</em></span>{conversation.unread && <i />}</button>)}</div></aside><section className="chat-pane"><header className="chat-header"><MessageAvatar avatar={active.avatar} initials={active.initials} /><div><strong>{active.name}</strong><small><span className="online-dot"></span>{active.status}</small></div><div className="chat-header-actions"><button title="Report user" onClick={() => setStatus('Report option opened.')}><ShieldCheck size={15} /></button><button title="Block user" onClick={() => setStatus('Member blocked.')}><X size={15} /></button></div></header><div className="exchange-context"><div><span className="profile-label">exchange context</span><strong>{active.skill}</strong><small>{active.match}% match · {active.exchange}</small></div><button onClick={() => setConversations((items) => items.map((item) => item.id === active.id ? { ...item, exchange: item.exchange === 'Complete' ? 'In progress' : 'Complete' } : item))}><Check size={14} /> {active.exchange === 'Complete' ? 'Completed' : 'Mark complete'}</button></div><div className="chat-messages">{(chat[activeId] || []).map((message, index) => <div className={message.from === 'me' ? 'chat-bubble me' : 'chat-bubble'} key={`${message.id || message.time}-${index}`}>{message.text}<small>{message.time} · {message.status || 'Delivered'}</small></div>)}{activeTypingUser && <div className="typing-indicator">{activeTypingUser} is typing...</div>}<span ref={messagesEndRef} /></div><div className="message-templates">{['I would like to learn...', 'I can teach...', 'Are you available this weekend?', 'Let’s schedule our exchange.'].map((template) => <button key={template} onClick={() => setDraft(template)}>{template}</button>)}</div><div className="message-composer"><button title="Attach resource" onClick={() => setStatus('Attachment picker ready for portfolio, resume or learning resources.')}><Bookmark size={16} /></button><input aria-label="Write a message" placeholder={`Write to ${active.name}...`} value={draft} onChange={(event) => { setDraft(event.target.value); setTyping(true); window.clearTimeout(window.messageTypingTimer); window.messageTypingTimer = window.setTimeout(() => setTyping(false), 800); }} onKeyDown={(event) => event.key === 'Enter' && sendLiveMessage()} /><button onClick={sendLiveMessage} aria-label="Send message"></button></div></section><aside className="chat-details"><span className="profile-label">conversation profile</span><div className="chat-profile"><MessageAvatar avatar={active.avatar} initials={active.initials} className="profile-avatar" /><h3>{active.name}</h3><small>{active.status}</small></div><div className="chat-detail-block"><b>Skills</b><span>{active.skill}</span></div><div className="chat-detail-block"><b>Rating</b><span><Star size={13} fill="currentColor" /> {active.rating || 'New'} · 12 exchanges</span></div><div className="chat-detail-block"><b>Availability</b><span>{active.availability} · Online</span></div><div className="chat-actions"><button onClick={() => setScheduled(true)}><CalendarDays size={15} /> Suggest a time</button><button onClick={createRoom}><Video size={15} /> Create video room</button><button onClick={() => setStatus('Exchange request sent.')}><Repeat2 size={15} /> Start exchange</button></div>{scheduled && <div className="schedule-box"><strong>Schedule session</strong><input type="date" /><input type="time" /><select><option>Online</option><option>Video call</option><option>In person</option></select><button className="button button-dark" onClick={() => { setScheduled(false); setStatus('Session confirmed and reminder saved.'); }}>Confirm time</button></div>}{room && <a className="room-link" href={room} target="_blank" rel="noreferrer">Open meeting room</a>}{status && <p className="password-status" role="status">{status}</p>}</aside></div></div>;
}

function AdvancedPanel({ user, onClose, onSaved }) {
  const [matches, setMatches] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [portfolio, setPortfolio] = useState({ portfolioUrl: user?.portfolioUrl || '', resumeName: user?.resumeName || '', certificates: user?.certificates || [] });
  const [certificate, setCertificate] = useState({ title: '', issuer: '', year: '' });
  const [room, setRoom] = useState('');
  const [pendingRoom, setPendingRoom] = useState('');
  const [status, setStatus] = useState('');
  const [roomCreating, setRoomCreating] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  useEffect(() => { if (!user?.email) return undefined; getSkillMatches(user.email).then(setMatches).catch(() => setMatches([])); getRecommendations(user.email).then(setRecommendations).catch(() => setRecommendations([])); return undefined; }, [user?.email]);
  const save = async (event) => { event.preventDefault(); try { const updated = await updatePortfolio(user._id || user.email, portfolio); onSaved(updated); setStatus('Portfolio and credentials saved.'); } catch (error) { setStatus(error.message); } };
  const addCertificate = () => { if (!certificate.title.trim() || !certificate.issuer.trim()) return; setPortfolio((current) => ({ ...current, certificates: [...current.certificates, certificate] })); setCertificate({ title: '', issuer: '', year: '' }); };
  const createRoom = async () => {
    if (roomCreating) return;
    setRoomCreating(true);
    setRoomCopied(false);
    setStatus('');
    try {
      const result = await createVideoRoom();
      setPendingRoom(result.url);
    } catch (error) {
      setStatus(error.message || 'Could not create video room.');
    } finally {
      setRoomCreating(false);
    }
  };
  const openRoom = () => {
    if (!pendingRoom) return;
    setRoom(pendingRoom);
    localStorage.setItem('skillswap-video-room', pendingRoom);
    setPendingRoom('');
    window.open(pendingRoom, '_blank', 'noopener,noreferrer');
  };
  const cancelRoom = () => setPendingRoom('');
  const copyRoom = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room);
      setRoomCopied(true);
      setStatus('Meeting link copied to clipboard.');
      window.setTimeout(() => setRoomCopied(false), 1800);
    } catch {
      setStatus('Copy failed. Use the Open meeting room link instead.');
    }
  };
  if (!user) return <div className="modal-backdrop"><div className="modal-panel advanced-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="account-panel-icon"><Target size={23} /></div><div className="eyebrow">advanced workspace</div><h2>Build your learning signal.</h2><p>Log in to see AI matches, recommendations, credentials and your professional sharing tools.</p><button className="button button-dark" onClick={onClose}>Close <Check size={16} /></button></div></div>;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel advanced-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow"><Sparkles size={14} /> advanced workspace</div><h2>Your exchange advantage.</h2><p>Use your profile signals to find better trades and show the work behind your skills.</p><div className="advanced-grid"><section className="advanced-card"><div className="advanced-card-title"><Target size={18} /><strong>AI skill matching</strong></div>{matches.length ? matches.slice(0, 4).map((item) => <div className="match-row" key={item.skill._id || item.skill.title}><span><strong>{item.skill.title}</strong><small>{item.skill.teacher.name}</small></span><b>{item.matchScore}%</b></div>) : <small className="advanced-muted">Add teaching and learning goals to unlock matches.</small>}</section><section className="advanced-card"><div className="advanced-card-title"><Star size={18} /><strong>Recommended for you</strong></div>{recommendations.length ? recommendations.slice(0, 4).map((skill) => <div className="recommend-row" key={skill._id || skill.title}><span>{skill.title}</span><small>{skill.category}</small></div>) : <small className="advanced-muted">Recommendations will appear as your interests grow.</small>}</section></div><section className="advanced-card portfolio-card"><div className="advanced-card-title"><BriefcaseBusiness size={18} /><strong>Resume and portfolio</strong></div><form onSubmit={save} className="advanced-form"><input aria-label="Portfolio link" placeholder="Portfolio or LinkedIn URL" value={portfolio.portfolioUrl} onChange={(event) => setPortfolio({ ...portfolio, portfolioUrl: event.target.value })} /><label className="resume-input"><Award size={15} /><span>{portfolio.resumeName || 'Share a resume'}</span><input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setPortfolio({ ...portfolio, resumeName: event.target.files?.[0]?.name || '' })} /></label><div className="certificate-form"><input aria-label="Certificate title" placeholder="Certificate title" value={certificate.title} onChange={(event) => setCertificate({ ...certificate, title: event.target.value })} /><input aria-label="Certificate issuer" placeholder="Issuer" value={certificate.issuer} onChange={(event) => setCertificate({ ...certificate, issuer: event.target.value })} /><input aria-label="Certificate year" placeholder="Year" value={certificate.year} onChange={(event) => setCertificate({ ...certificate, year: event.target.value })} /><button type="button" className="button button-light" onClick={addCertificate}>Add certificate <Award size={15} /></button></div>{portfolio.certificates.length > 0 && <div className="certificate-list">{portfolio.certificates.map((item, index) => <span key={`${item.title}-${index}`}><Award size={13} /> {item.title} · {item.issuer} {item.year && `(${item.year})`}</span>)}</div>}<button className="button button-dark" type="submit">Save credentials <Check size={16} /></button></form></section><section className="advanced-card video-card"><div className="advanced-card-title"><Video size={18} /><strong>Video exchange room</strong></div><p>Create a unique Jitsi meeting room for your next skill-exchange session.</p><div className="video-room-actions"><button className="button button-light" onClick={createRoom} disabled={roomCreating}>{roomCreating ? 'Creating room…' : room ? 'Create new room' : 'Create room'} <Video size={15} /></button>{room && <button type="button" className="button button-dark video-room-copy" onClick={copyRoom}>{roomCopied ? 'Copied' : 'Copy link'} <Share2 size={15} /></button>}</div>{room && <div className="video-room-ready"><span>Meeting room ready</span><a className="room-link" href={room} target="_blank" rel="noreferrer">Open meeting room <ArrowUp size={14} /></a></div>}{pendingRoom && <div className="video-room-permission-backdrop" onMouseDown={(event) => event.target === event.currentTarget && cancelRoom()}><div className="video-room-permission" role="dialog" aria-modal="true" aria-labelledby="video-room-permission-title"><div className="video-room-permission-icon"><Video size={22} /></div><strong id="video-room-permission-title">Open video room?</strong><p>Your private Jitsi room is ready. Do you want to open the meeting now?</p><div className="video-room-permission-actions"><button type="button" className="button button-light" onClick={cancelRoom}>Not now</button><button type="button" className="button button-dark" onClick={openRoom}>Open meeting room <ArrowUp size={14} /></button></div></div></div>}</section>{status && <p className="password-status" role="status">{status}</p>}<button className="button button-dark" onClick={onClose}>Done <Check size={16} /></button></div></div>;
}

function NotificationsPanel({ notifications, onNotificationClick, onMarkRead, onClose }) {
  return <div className="notification-popover"><div className="notification-popover-head"><strong>Notifications</strong><button onClick={onClose} aria-label="Close notifications"><X size={15} /></button></div>{notifications.length ? notifications.map((notification) => <div className={`notification-item ${notification.type === 'message' ? 'notification-item-clickable' : ''}`} key={notification._id} onClick={() => notification.type === 'message' && onNotificationClick(notification)} role={notification.type === 'message' ? 'button' : undefined} tabIndex={notification.type === 'message' ? 0 : undefined}><span className="notification-icon"><MessageCircle size={15} /></span><span><strong>{notification.title}</strong><small>{new Date(notification.createdAt).toLocaleString()}</small></span></div>) : <div className="notification-empty">No notification history yet.</div>}<button className="notification-clear" onClick={onMarkRead}>Mark all as read</button></div>;
}

function SkillDetailPanel({ skill, currentUser, onClose, onConnect, onOffer }) {
  const teacher = skill.teacher;
  return <div className="modal-backdrop skill-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="modal-panel skill-detail-panel" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title">
    <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
    <div className="skill-detail-hero" style={{ background: skill.color }}><span>{skill.category}</span><strong>{skill.title.charAt(0)}</strong></div>
    <div className="eyebrow">skill exchange</div><h2 id="skill-detail-title">{skill.title}</h2><p>{skill.description}</p>
    <div className="skill-detail-teacher"><span className="detail-avatar">{teacher.avatar}</span><div><strong>{teacher.name}</strong><small>{teacher.role} · {teacher.location}</small></div><span className="detail-rating"><Star size={14} fill="currentColor" /> {teacher.rating}</span></div>
    <div className="skill-detail-facts"><span><b>Format</b>{skill.format}</span><span><b>Level</b>{skill.level}</span><span><b>Availability</b>{skill.availability || 'Flexible'}</span><span><b>Exchanges</b>{teacher.exchanges || 0} completed</span></div>
    <div className="skill-detail-expectation"><span className="profile-label">exchange expectation</span><strong>{skill.wants}</strong><small>Offer something useful in return and agree on a format together.</small></div>
    <div className="skill-detail-reviews"><span className="profile-label">reviews</span><p><Star size={13} fill="currentColor" /> {teacher.rating} average from {teacher.exchanges || 0} completed exchanges.</p></div>
    <div className="skill-detail-actions"><button className="button button-dark" onClick={() => onConnect({ name: teacher.name, email: teacher.email || '' })}>Start exchange </button><button className="button button-light" onClick={onOffer}>Offer your skill <Repeat2 size={16} /></button></div>
  </article></div>;
}

function PeopleDirectory({ people: sourcePeople, currentUser, search, setSearch, location, setLocation, format, setFormat, availability, setAvailability, level: initialLevel, sort, setSort, savedPeople, onDetails, onMessage, onSave }) {
  const [peopleLevel, setPeopleLevel] = useState(initialLevel || '');
  const [peoplePage, setPeoplePage] = useState(1);
  const level = peopleLevel;
  const setLevel = setPeopleLevel;
  const normalizedSearch = search.toLowerCase().trim();
  const filtered = sourcePeople.filter((person) => {
    const text = `${person.name} ${person.role} ${person.city} ${person.skills} ${person.wants}`.toLowerCase();
    return (!normalizedSearch || matchesSearchText(text, normalizedSearch)) && (!location || person.city.toLowerCase().includes(location.toLowerCase())) && (!format || person.format === format) && (!availability || person.availability === availability) && (!peopleLevel || (person.experience || 'Intermediate') === peopleLevel);
  }).map((person) => ({ ...person, matchScore: Math.min(99, 70 + ((currentUser?.teaches || []).some((skill) => person.wants.toLowerCase().includes(skill.toLowerCase())) ? 15 : 0) + ((currentUser?.wants || []).some((skill) => person.skills.toLowerCase().includes(skill.toLowerCase())) ? 15 : 0)) })).sort((first, second) => sort === 'rating' ? second.rating - first.rating : sort === 'newest' ? second.name.localeCompare(first.name) : sort === 'nearby' && location ? Number(second.city.toLowerCase().includes(location.toLowerCase())) - Number(first.city.toLowerCase().includes(location.toLowerCase())) : sort === 'active' ? second.exchanges - first.exchanges : second.matchScore - first.matchScore);
  const pageSize = 9;
  const pageCount = Math.ceil(filtered.length / pageSize);
  const visiblePeople = filtered.slice((peoplePage - 1) * pageSize, peoplePage * pageSize);
  useEffect(() => { setPeoplePage(1); }, [normalizedSearch, location, format, availability, peopleLevel, sort]);
  useEffect(() => { if (peoplePage > pageCount && pageCount > 0) setPeoplePage(pageCount); }, [peoplePage, pageCount]);
  return <div className="people-directory">
    <div className="people-directory-toolbar"><label className="search-box"><Search size={17} /><input aria-label="Search people, skills or roles" placeholder="Search people, skills or roles" value={search} onChange={(event) => setSearch(event.target.value)} /></label><input aria-label="People location" placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} /><select aria-label="People format" value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Online or in person</option><option>Online</option><option>Video call</option><option>In person</option></select><select aria-label="People availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option>Weekdays</option><option>Weekends</option><option>Flexible</option></select><select aria-label="People experience" value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Any experience</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select><select aria-label="Sort people" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Best match</option><option value="rating">Highest rated</option><option value="active">Most active</option><option value="newest">Newest members</option><option value="nearby">Nearest location</option></select></div>
    <div className="people-directory-summary">{filtered.length} people to meet <span>·</span> matched to your goals</div>
    <div className="people-directory-grid">{filtered.length ? visiblePeople.map((person) => { const saved = savedPeople.some((item) => item.name === person.name); return <article className="person-directory-card" key={person.name} onClick={(event) => { if (!event.target.closest('button')) onDetails(person); }}><div className="person-directory-top"><div className="person-avatar" style={{ background: person.color }}>{person.avatar ? <img src={person.avatar} alt="" /> : person.initials}</div><span className="match-score">{person.matchScore}% match</span><button className="person-save" onClick={() => onSave(person)} aria-label={saved ? `Remove ${person.name}` : `Save ${person.name}`}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="person-directory-main"><h3>{person.name} {person.verified && <span className="verified-badge" title="Verified email">✓</span>}</h3><p>{person.role}</p><small>{person.city} · {person.lastActive}</small><div className="person-directory-skills">{person.skills.split(' · ').map((skill) => <span key={skill}>{skill}</span>)}</div><div className="person-directory-wants"><b>Wants to learn</b>{person.wants}</div><div className="person-directory-meta"><span><Star size={12} fill="currentColor" /> {person.rating}</span><span>{person.exchanges} exchanges</span><span>{person.responseTime}</span></div></div><div className="person-directory-actions"><button onClick={() => onMessage({ name: person.name, email: person.email || '' })}><MessageCircle size={14} /> Message</button><button onClick={() => onDetails(person)}>View profile </button></div></article>; }) : <EmptyState />}</div>{pageCount > 1 && <nav className="people-pagination" aria-label="People pages">{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} className={peoplePage === page ? 'active' : ''} onClick={() => setPeoplePage(page)} aria-label={`Go to people page ${page}`}>{page}</button>)}</nav>}
  </div>;
}

function PeopleProfilePanel({ person, onClose, onMessage, onOffer }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="modal-panel people-profile-panel" role="dialog" aria-modal="true" aria-labelledby="people-profile-title"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="people-profile-heading"><span className="profile-avatar" style={{ background: person.color }}>{person.avatar ? <img src={person.avatar} alt="" /> : person.initials}</span><div><div className="eyebrow">community profile</div><h2 id="people-profile-title">{person.name} {person.verified && <span className="verified-badge">✓</span>}</h2><p>{person.role} · {person.city}</p><small>{person.lastActive} · {person.responseTime}</small></div></div><p className="people-profile-bio">{person.bio}</p><div className="people-profile-facts"><span><b>Rating</b><strong><Star size={13} fill="currentColor" /> {person.rating}</strong></span><span><b>Successful exchanges</b><strong>{person.exchanges}</strong></span><span><b>Availability</b><strong>{person.availability}</strong></span><span><b>Format</b><strong>{person.format}</strong></span></div><div className="people-profile-section"><span className="profile-label">skills they teach</span><div className="profile-tags">{person.skills.split(' · ').map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="people-profile-section"><span className="profile-label">skills they want to learn</span><p>{person.wants}</p></div><div className="people-profile-section"><span className="profile-label">reviews & exchange history</span><p>Trusted member with {person.exchanges} successful exchanges and a {person.rating} average rating.</p></div><div className="skill-detail-actions"><button className="button button-dark" onClick={onMessage}>Message <MessageCircle size={16} /></button><button className="button button-light" onClick={onOffer}>Send exchange request <Repeat2 size={16} /></button></div></article></div>;
}

const communityStories = [
  { id: 'community-story', category: 'Community story', title: 'A useful exchange became a shared rhythm.', name: 'Community member', role: 'Verified member', city: 'Location not shared', initials: 'CM', color: '#dce9df', learned: 'A new skill', taught: 'A practical skill', result: 'Two verified members found a useful way to learn together.', before: 'A goal was waiting for the right partner.', after: 'The exchange made progress feel possible.', partner: 'Another verified member', rating: 5, exchanges: 1, timeline: 'A few shared sessions', helpful: 100, verified: true }
];

function StoriesPage({ currentUser, savedStories, onSaveStory, onStoryDetails, onStart }) {
  const [category, setCategory] = useState('All stories');
  const [sort, setSort] = useState('helpful');
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [liked, setLiked] = useState({});
  const categories = ['All stories', 'First exchange', 'Career growth', 'New friendship', 'Creative collaboration', 'Confidence building'];
  const stories = communityStories.filter((story) => category === 'All stories' || story.category === category).sort((first, second) => sort === 'newest' ? second.id.localeCompare(first.id) : sort === 'rating' ? second.rating - first.rating : second.helpful - first.helpful);
  return <div className="stories-page"><section className="stories-featured"><div><span className="profile-label">featured story · this week</span><h2>{communityStories[0].title}</h2><p>{communityStories[0].result}</p><button className="button button-dark" onClick={() => onStoryDetails(communityStories[0])}>Read their exchange </button></div><div className="featured-stat"><strong>18</strong><span>successful exchanges</span><strong>94%</strong><span>community found it helpful</span></div></section><section className="stories-impact"><div><strong>2,400+</strong><span>skills exchanged</span></div><div><strong>8,920</strong><span>hours shared</span></div><div><strong>4.9</strong><span>average rating</span></div><div><strong>32</strong><span>cities reached</span></div></section><div className="stories-toolbar"><div className="stories-categories">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><select aria-label="Sort stories" value={sort} onChange={(event) => setSort(event.target.value)}><option value="helpful">Most helpful</option><option value="newest">Newest</option><option value="rating">Highest rated</option></select></div><section className="stories-grid">{stories.map((story) => { const saved = savedStories.some((item) => item.id === story.id); return <article className="story-card" key={story.id} onClick={(event) => { if (!event.target.closest('button')) onStoryDetails(story); }}><div className="story-card-top" style={{ background: story.color }}><span>{story.category}</span><strong>{story.initials}</strong></div><div className="story-card-body"><div className="story-card-person"><div><strong>{story.name} {story.verified && <span className="verified-badge">✓</span>}</strong><small>{story.role} · {story.city}</small></div><button onClick={() => onSaveStory(story)} aria-label={saved ? 'Remove saved story' : 'Save story'}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button></div><h3>{story.title}</h3><p>{story.result}</p><div className="story-card-meta"><span><Star size={12} fill="currentColor" /> {story.rating}</span><span>{story.exchanges} swaps</span><span>{story.learned} ↔ {story.taught}</span></div><div className="story-card-actions"><button onClick={() => setLiked((items) => ({ ...items, [story.id]: !items[story.id] }))}><HeartIcon filled={liked[story.id]} /> {liked[story.id] ? 'Liked' : 'Like'}</button><button onClick={() => onStoryDetails(story)}>Read story </button></div></div></article>; })}</section><section className="stories-submit"><div><span className="profile-label">your exchange matters</span><h2>Turn a good trade into a story.</h2><p>Share what changed before and after your exchange and inspire the next member.</p></div><button className="button button-dark" onClick={() => setSubmissionOpen(true)}>Share your story </button></section>{submissionOpen && <StorySubmissionPanel currentUser={currentUser} onClose={() => setSubmissionOpen(false)} onPublished={() => setSubmissionOpen(false)} />}<p className="stories-trust"><ShieldCheck size={15} /> Stories are published only after both exchange partners approve them.</p></div>;
}

function HeartIcon({ filled }) { return <span className={filled ? 'story-heart filled' : 'story-heart'}>♥</span>; }

function StoryDetailPanel({ story, onClose, onStart }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="modal-panel story-detail-panel" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="story-detail-cover" style={{ background: story.color }}><span>{story.category}</span><strong>{story.initials}</strong></div><div className="eyebrow">verified exchange story</div><h2>{story.title}</h2><p className="story-detail-result">{story.result}</p><div className="story-detail-person"><span className="detail-avatar">{story.initials}</span><div><strong>{story.name} <span className="verified-badge">✓</span></strong><small>{story.role} · {story.city}</small></div></div><div className="story-before-after"><div><span>Before SkillSwap</span><p>{story.before}</p></div><div><span>After the exchange</span><p>{story.after}</p></div></div><div className="story-detail-facts"><span><b>Learned</b><strong>{story.learned}</strong></span><span><b>Taught</b><strong>{story.taught}</strong></span><span><b>Timeline</b><strong>{story.timeline}</strong></span><span><b>Rating</b><strong><Star size={12} fill="currentColor" /> {story.rating}</strong></span></div><div className="story-partner"><span className="profile-label">exchange partner</span><strong>{story.partner}</strong><small>Both partners approved this story · {story.exchanges} successful exchanges</small></div><div className="skill-detail-actions"><button className="button button-dark" onClick={onStart}>Start a similar exchange </button><button className="button button-light" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Share story <Share2 size={16} /></button></div></article></div>;
}

function StorySubmissionPanel({ currentUser, onClose, onPublished }) {
  const [title, setTitle] = useState('');
  const [result, setResult] = useState('');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-panel story-submission-panel"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow">share your exchange</div><h2>What changed for you?</h2><p>Select a completed exchange and tell the community what you learned.</p><select aria-label="Completed exchange"><option>Choose a completed exchange</option></select><input aria-label="Story title" placeholder="Story title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea aria-label="Story result" rows="4" placeholder="What was the result?" value={result} onChange={(event) => setResult(event.target.value)} /><div className="submission-approval"><CheckCircle2 size={16} /> Your partner will approve this story before it is published.</div><button className="button button-dark" onClick={onPublished} disabled={!title.trim() || !result.trim()}>Publish story </button>{currentUser && <small>Publishing as {currentUser.name}</small>}</div></div>;
}

function HowItWorksPage({ currentUser, skills, onClose, onConnect }) {
  const [activeStep, setActiveStep] = useState(0);
  const verifiedUserSkill = currentUser?.emailVerified ? (currentUser.wants?.[0] || '') : '';
  const [demoSkill, setDemoSkill] = useState(verifiedUserSkill);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    if (!verifiedUserSkill) {
      setDemoSkill('');
      return;
    }
    const matchedSkill = skills.find((skill) => skill.title.toLowerCase() === verifiedUserSkill.toLowerCase());
    setDemoSkill(matchedSkill?.title || '');
  }, [skills, verifiedUserSkill]);
  const steps = [['Create your profile', 'Tell the community who you are and what makes your perspective useful.'], ['Add what you teach', 'Put your practical skills on the table so the right people can find you.'], ['Add what you want to learn', 'Name the next skill or goal you are curious about.'], ['Find your match', 'We compare teaching and learning goals to surface a useful fit.'], ['Send an exchange request', 'Message your match and suggest what you can trade.'], ['Agree on time and format', 'Choose online, video call, in person or a flexible rhythm.'], ['Complete the exchange', 'Show up, share generously and mark the session complete.'], ['Leave a review', 'Give your partner useful feedback and build trust for the next trade.']];
  const selectedSkill = skills.find((skill) => skill.title === demoSkill);
  const goTo = (id) => { onClose(); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 0); };
  const faqs = [['Is SkillSwap free?', 'Yes. SkillSwap is built around exchanging useful time and knowledge, with no money required for a good trade.'], ['How do I start an exchange?', 'Create a profile, add one skill you teach and one thing you want to learn, then message a promising match.'], ['What if my match does not reply?', 'Give them a little time, then browse another match. Your saved skills and goals stay ready for the next conversation.'], ['How do online exchanges work?', 'Agree on a time and use messages or a free video room to meet. Both people decide the format before the session.'], ['Are profiles verified?', 'Email verification, ratings, successful exchanges and reporting tools help the community make informed choices.']];
  return <div className="how-it-works-page">
    <div className="how-flow"><div className="how-flow-heading"><span className="profile-label">the exchange rhythm</span><strong>Discover <i>→</i> Match <i>→</i> Request <i>→</i> Schedule <i>→</i> Exchange <i>→</i> Review</strong></div><div className="how-step-list">{steps.map(([title, text], index) => <button key={title} className={activeStep === index ? 'active' : ''} onClick={() => setActiveStep(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{title}</strong></button>)}</div><div className="how-step-detail"><span className="eyebrow">step {String(activeStep + 1).padStart(2, '0')}</span><h2>{steps[activeStep][0]}.</h2><p>{steps[activeStep][1]}</p><div className="how-progress"><span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}></span></div></div></div>
    <section className="how-demo"><div><span className="profile-label">try a match</span><h2>What would you like to exchange?</h2><p>Select a skill and see how the matching signal comes together.</p><select value={demoSkill} onChange={(event) => setDemoSkill(event.target.value)}><option value="">Select a skill</option>{skills.slice(0, 8).map((skill) => <option key={skill.title} value={skill.title}>{skill.title}</option>)}</select></div>{selectedSkill && <div className="how-demo-match"><span className="match-score">92% match</span><div className="demo-match-person"><span className="detail-avatar">{selectedSkill.teacher.avatar}</span><div><strong>{selectedSkill.teacher.name}</strong><small>{selectedSkill.teacher.role}</small></div></div><div className="demo-match-reasons"><span><Check size={13} /> You want to learn {selectedSkill.title}</span><span><Repeat2 size={13} /> They want: {selectedSkill.wants}</span><span><Clock3 size={13} /> {selectedSkill.format} · Flexible timing</span></div><button className="button button-dark" onClick={() => onConnect({ name: selectedSkill.teacher.name, email: selectedSkill.teacher.email || '' })}>Start an exchange </button></div>}</section>
    <section className="how-explanation"><div><span className="profile-label">how matching works</span><h2>A useful match is more than a shared keyword.</h2></div><div className="how-explanation-grid"><div><strong>01</strong><h3>Shared goals</h3><p>Your wants meet their teaching skills, and their wants meet yours.</p></div><div><strong>02</strong><h3>Practical fit</h3><p>Format, availability and location help turn a promising idea into a real session.</p></div><div><strong>03</strong><h3>Trust signals</h3><p>Ratings, verification and exchange history add confidence before you message.</p></div></div></section>
    <section className="how-timeline"><span className="profile-label">exchange timeline</span><div className="timeline-row">{['Request sent', 'Request accepted', 'Session scheduled', 'Exchange completed', 'Review submitted'].map((item, index) => <div className={index === 0 ? 'active' : ''} key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}</div></section>
    <section className="how-formats"><div><span className="profile-label">choose your rhythm</span><h2>Exchange in the way that fits.</h2></div><div className="format-grid">{[['Online', 'Async notes and shared resources.'], ['Video call', 'Meet face-to-face from anywhere.'], ['In person', 'Learn together in your city.'], ['Flexible', 'Let both schedules set the pace.']].map(([title, text]) => <div key={title}><CalendarDays size={18} /><strong>{title}</strong><p>{text}</p></div>)}</div></section>
    <section className="how-safety"><div><ShieldCheck size={24} /><span className="profile-label">trust & safety</span><h2>Good exchanges feel safe.</h2></div><div className="safety-grid"><span><CheckCircle2 size={16} /> Verified profiles</span><span><Star size={16} /> Ratings and reviews</span><span><MessageCircle size={16} /> Safe messaging</span><span><ShieldCheck size={16} /> Report and block tools</span></div></section>
    <section className="how-ctas"><h2>Ready to make something useful move?</h2><div><button className="button button-dark" onClick={() => goTo('explore')}>Explore skills </button><button className="button button-light" onClick={() => goTo('people')}>Find people <UsersRound size={16} /></button>{!currentUser && <button className="text-button" onClick={() => onClose()}>Create profile </button>}</div></section>
    <section className="how-faq"><span className="profile-label">questions, answered</span><h2>Frequently asked.</h2>{faqs.map(([question, answer], index) => <div className="faq-item" key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><strong>{question}</strong><ChevronDown size={16} className={openFaq === index ? 'faq-open' : ''} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</section>
  </div>;
}

function CommunityWorkspace({ currentUser, onConnect }) {
  const [groups, setGroups] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [joined, setJoined] = useState({});
  const [tab, setTab] = useState('home');
  const [room, setRoom] = useState('');
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState([
    { id: 'post-1', type: 'Community note', author: 'Community member', initials: 'CM', title: 'Start with one small exchange.', body: 'A short session can be enough to find a learning rhythm that works for both people.', likes: 0, comments: 0, liked: false }
  ]);
  const events = [['Community skill circle', 'Thu, 7:00 PM', '12 members', 'Online'], ['Portfolio review hour', 'Sat, 11:00 AM', '8 members', 'Video call'], ['Creative exchange meetup', 'Sun, 4:00 PM', '24 members', 'London · In person']];
  useEffect(() => { getGroups().then(setGroups).catch(() => setGroups([])); getLeaderboard().then(setLeaders).catch(() => setLeaders([])); }, []);
  const fallbackGroups = [['Technology', 'Build, debug and learn together.', '1.2k'], ['Creative', 'Make room for better ideas.', '864'], ['Languages', 'Practice without pressure.', '642'], ['Career', 'Trade experience and momentum.', '521'], ['Wellness', 'Small routines, shared gently.', '389'], ['Local city groups', 'Find people near your city.', '214']];
  const join = async (group) => { try { const updated = group._id ? await joinGroup(group._id) : group; setJoined((items) => ({ ...items, [group._id || group.name]: true })); if (group._id) setGroups((items) => items.map((item) => item._id === group._id ? updated : item)); } catch { setJoined((items) => ({ ...items, [group._id || group.name]: true })); } };
  const createRoom = async () => { try { const result = await createVideoRoom(); setRoom(result.url); } catch { setRoom('Room unavailable right now.'); } };
  const publishPost = () => { if (!postText.trim()) return; setPosts((items) => [{ id: `post-${Date.now()}`, type: 'Announcement', author: currentUser?.name || 'You', initials: (currentUser?.name || 'You').slice(0, 2).toUpperCase(), title: 'A new community note', body: postText.trim(), likes: 0, comments: 0, liked: false }, ...items]); setPostText(''); setTab('feed'); };
  return <div className="community-workspace">
    <div className="community-stats"><div><strong>2,400+</strong><span>community members</span></div><div><strong>18</strong><span>active groups</span></div><div><strong>486</strong><span>exchanges this month</span></div><div><strong>32</strong><span>cities represented</span></div></div>
    <div className="community-tabs">{[['home', 'Overview'], ['groups', 'Groups'], ['feed', 'Community feed'], ['events', 'Events'], ['leaderboard', 'Leaderboard'], ['discussions', 'Discussions'], ['rooms', 'Video rooms']].map(([value, label]) => <button className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {(tab === 'home' || tab === 'groups') && <section className="community-workspace-section"><div className="community-section-heading"><div><span className="profile-label">find your circle</span><h2>Groups for every kind of curious.</h2></div><small>Join, leave and learn together.</small></div><div className="community-groups-grid">{(groups.length ? groups : fallbackGroups.map(([name, description, members]) => ({ name, description, members }))).map((group) => { const key = group._id || group.name; return <article className="community-group-card" key={key}><span className="group-icon"><UsersRound size={18} /></span><span><strong>{group.name}</strong><small>{group.description}</small><em>{group.members || 0} members · discussions · resources</em></span><button onClick={() => join(group)}>{joined[key] ? 'Joined' : 'Join group'}</button></article>; })}</div></section>}
    {(tab === 'home' || tab === 'feed' || tab === 'discussions') && <section className="community-workspace-section"><div className="community-section-heading"><div><span className="profile-label">community feed</span><h2>Useful things moving.</h2></div><button className="button button-light" onClick={() => setTab('compose')}>Share a post </button></div><div className="community-feed-grid">{posts.map((post) => <article className="community-post" key={post.id}><div className="community-post-head"><span className="message-avatar">{post.initials}</span><span><strong>{post.author}</strong><small>{post.type} · just now</small></span><button aria-label="Report post" title="Report post"><ShieldCheck size={15} /></button></div><h3>{post.title}</h3><p>{post.body}</p><div className="community-post-actions"><button onClick={() => setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item))}><Star size={14} fill={post.liked ? 'currentColor' : 'none'} /> Helpful · {post.likes}</button><button onClick={() => setTab('discussions')}><MessageCircle size={14} /> Reply · {post.comments}</button></div></article>)}</div></section>}
    {tab === 'compose' && <section className="community-compose"><span className="profile-label">community feed</span><h2>What would you like to share?</h2><select><option>Announcement</option><option>Question</option><option>Tip</option><option>Success story</option></select><textarea rows="5" placeholder="Share a question, resource or small win..." value={postText} onChange={(event) => setPostText(event.target.value)} /><div><button className="button button-dark" onClick={publishPost}>Publish post </button><button className="text-button" onClick={() => setTab('feed')}>Cancel</button></div></section>}
    {(tab === 'home' || tab === 'events') && <section className="community-workspace-section"><div className="community-section-heading"><div><span className="profile-label">upcoming events</span><h2>Show up together.</h2></div><CalendarDays size={21} /></div><div className="community-events-grid">{events.map(([title, date, members, format]) => <article className="community-event" key={title}><span className="event-date">{date}</span><h3>{title}</h3><p>{format} · {members}</p><button onClick={() => {}}><CalendarDays size={14} /> Add reminder</button></article>)}</div></section>}
    {(tab === 'home' || tab === 'leaderboard') && <section className="community-workspace-section"><div className="community-section-heading"><div><span className="profile-label">community leaderboard</span><h2>Generosity gets noticed.</h2></div><Award size={21} /></div><div className="community-leaderboard">{leaders.length ? leaders.slice(0, 5).map((leader, index) => <div className="community-leader" key={leader.name}><b>#{index + 1}</b><span className="message-avatar">{leader.name.slice(0, 2).toUpperCase()}</span><strong>{leader.name}</strong><small>{leader.exchanges || 0} exchanges · {leader.rating || 'New'} rating</small><span className="leader-badge">Most helpful</span></div>) : <div className="community-empty">Verified members will appear here after completing exchanges.</div>}</div></section>}
    {(tab === 'home' || tab === 'rooms') && <section className="community-room-section"><div><span className="profile-label">community rooms</span><h2>Learn together, live.</h2><p>Create a free Jitsi room for a group session, workshop or skill circle.</p><button className="button button-dark" onClick={createRoom}>Create video room <Video size={16} /></button>{room && <a className="room-link" href={room} target="_blank" rel="noreferrer">{room.startsWith('http') ? 'Open meeting room' : room}</a>}</div><div className="community-room-art"><Video size={38} /><span>safe, simple, shared</span></div></section>}
    <section className="community-moderation"><ShieldCheck size={20} /><div><strong>Community guidelines</strong><p>Be generous, respect boundaries, protect private information and report content that does not belong here.</p></div><button onClick={() => {}}>Read guidelines</button></section>
  </div>;
}

function DedicatedPage({ page, currentUser, skills, similarPeople, peopleDirectory, savedStories, onSaveStory, onStoryDetails, search, setSearch, category, setCategory, sort, setSort, teachQuery, setTeachQuery, wantsQuery, setWantsQuery, location, setLocation, format, setFormat, level, setLevel, availability, setAvailability, savedSkills, savedPeople, onSave, onSavePerson, onDetails, onPersonDetails, onClose, onConnect }) {
  const pages = {
    explore: ['Explore skills', 'Find a skill exchange that fits the way you learn.'],
    people: ['Find people', 'Meet generous people with useful skills to share.'],
    how: ['How it works', 'A simple rhythm for turning curiosity into a good exchange.'],
    stories: ['Stories', 'Small trades can lead to meaningful new chapters.'],
    community: ['Community', 'Find your circle, learn together and celebrate skill-sharing.'],
    advanced: ['Advanced', 'Use your profile signals to make better exchanges.']
  };
  const [title, description] = pages[page];
  const normalizedSkillSearch = search.trim().toLowerCase();
  const matchingMembers = normalizedSkillSearch ? peopleDirectory.filter((person) => {
    const profileText = [
      person.name,
      person.role,
      person.city,
      person.skills,
      person.wants,
      person.bio,
      ...(person.teaches || []),
      ...(person.learning || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesSearchText(profileText, normalizedSkillSearch);
  }).slice(0, 8) : [];
  return <section className={`dedicated-page dedicated-page-${page}`} aria-labelledby="dedicated-page-title">
    <div className="dedicated-page-inner">
      <button className="dedicated-back" onClick={onClose}><ArrowLeftRight size={15} /> Back to exchange</button>
      <div className="eyebrow">skillswap workspace</div>
      <h1 id="dedicated-page-title">{title}.</h1>
      <p className="dedicated-intro">{description}</p>
      {page === 'explore' && <><div className="dedicated-explore-toolbar"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-box"><Search size={17} /><input aria-label="Search skills, teachers or categories" placeholder="Search skills, teachers or categories" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Sort skills" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Best match</option><option value="rating">Top rated</option><option value="newest">Recently added</option><option value="nearby">Nearby users</option></select></div><div className="discovery-filters"><input aria-label="I teach" placeholder="I teach..." value={teachQuery} onChange={(event) => setTeachQuery(event.target.value)} /><input aria-label="I want to learn" placeholder="I want to learn..." value={wantsQuery} onChange={(event) => setWantsQuery(event.target.value)} /><input aria-label="Location" placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} /><select aria-label="Format" value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Any format</option><option>Online</option><option>Video call</option><option>In person</option></select><select aria-label="Skill level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Any level</option><option>Beginner friendly</option><option>Intermediate</option><option>Advanced</option></select><select aria-label="Availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option>Weekdays</option><option>Weekends</option><option>Flexible</option></select></div><div className="dedicated-skill-grid">{skills.length ? skills.map((skill) => <SkillCard key={skill._id || skill.title} skill={skill} saved={savedSkills.some((item) => item._id === skill._id)} onSave={() => onSave(skill)} onDetails={() => onDetails(skill)} onConnect={() => onConnect({ name: skill.teacher.name, email: skill.teacher.email || '' })} />) : <EmptyState />}</div>{matchingMembers.length > 0 && <section className="explore-member-matches"><div className="explore-member-heading"><span className="profile-label">members mentioning “{search}”</span><small>People whose profile, teaching or learning goals mention this skill.</small></div><div className="explore-member-grid">{matchingMembers.map((person) => <article className="explore-member-card" key={person._id || person.email || person.name}><span className="explore-member-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.initials || person.name?.slice(0, 2).toUpperCase()}</span><div><strong>{person.name}</strong><small>{person.role || 'Community member'}</small><span>{person.skills || person.wants || 'Skill mentioned in profile'}</span></div><button onClick={() => onPersonDetails(person)}>View profile </button></article>)}</div></section>}</>}
      {page === 'people' && <PeopleDirectory people={similarPeople} currentUser={currentUser} search={search} setSearch={setSearch} location={location} setLocation={setLocation} format={format} setFormat={setFormat} availability={availability} setAvailability={setAvailability} level={level} setLevel={level} sort={sort} setSort={setSort} savedPeople={savedPeople} onDetails={onPersonDetails} onMessage={onConnect} onSave={onSavePerson} />}
      {page === 'how' && <HowItWorksPage currentUser={currentUser} skills={skills} onClose={onClose} onConnect={onConnect} />}
      {page === 'stories' && <StoriesPage currentUser={currentUser} savedStories={savedStories} onSaveStory={onSaveStory} onStoryDetails={onStoryDetails} onStart={() => onClose()} />}
      {page === 'community' && <CommunityWorkspace currentUser={currentUser} onConnect={onConnect} />}
      {page === 'advanced' && <div className="dedicated-panels"><div><Target size={22} /><h2>Better matches.</h2><p>Teaching and learning goals help surface exchanges that fit your profile.</p></div><div><BriefcaseBusiness size={22} /><h2>Show your work.</h2><p>Keep your portfolio, credentials and learning signal together.</p></div></div>}
      {currentUser && <p className="dedicated-member-note">Signed in as {currentUser.name}.</p>}
    </div>
  </section>;
}

export default App;
