export const DOMAIN_KEYWORDS = {
  computer_science: [
    ['operating system', 3], ['process scheduling', 3], ['memory management', 3],
    ['virtual memory', 3], ['file system', 3], ['computer network', 3],
    ['tcp ip', 3], ['osi model', 3], ['http protocol', 2],
    ['relational database', 3], ['sql query', 2], ['nosql', 2],
    ['compiler design', 3], ['lexer', 2], ['parser', 2], ['ast', 2],
    ['design pattern', 3], ['solid principles', 3], ['microservice', 3],
    ['rest api', 3], ['graphql', 2], ['web socket', 2],
    ['object oriented', 3], ['functional programming', 3],
    ['docker', 2], ['kubernetes', 2], ['ci cd', 3], ['devops', 2],
    ['git', 1], ['version control', 2], ['agile', 1],
    ['programming', 1], ['database', 1], ['api', 1], ['class', 1],
    ['object', 1], ['variable', 1], ['loop', 1], ['function', 1],
    ['frontend', 1], ['backend', 1], ['cloud', 1],
    ['distributed system', 3], ['cap theorem', 3], ['consensus algorithm', 3],
    ['load balancer', 2], ['caching', 2], ['message queue', 2],
  ],
  data_science: [
    ['machine learning', 3], ['deep learning', 3], ['neural network', 3],
    ['convolutional neural network', 3], ['recurrent neural network', 3],
    ['transformer architecture', 3], ['large language model', 3],
    ['gradient descent', 3], ['backpropagation', 3], ['overfitting', 2],
    ['cross validation', 3], ['bias variance tradeoff', 3],
    ['random forest', 3], ['support vector machine', 3], ['k means clustering', 3],
    ['principal component analysis', 3], ['dimensionality reduction', 3],
    ['feature engineering', 3], ['data pipeline', 3], ['etl', 2],
    ['pandas', 2], ['numpy', 2], ['scikit learn', 3], ['pytorch', 2], ['tensorflow', 2],
    ['regression', 2], ['classification', 2], ['clustering', 2],
    ['recommendation system', 3], ['natural language processing', 3],
    ['computer vision', 3], ['reinforcement learning', 3],
    ['a b testing', 3], ['statistical significance', 3],
    ['data visualization', 2], ['tableau', 2], ['power bi', 2],
    ['sql analytics', 2], ['spark', 2], ['hadoop', 2],
  ],
  cybersecurity: [
    ['penetration testing', 3], ['ethical hacking', 3], ['vulnerability assessment', 3],
    ['sql injection', 3], ['cross site scripting', 3], ['csrf attack', 3],
    ['man in the middle', 3], ['social engineering', 3], ['phishing', 2],
    ['public key infrastructure', 3], ['rsa encryption', 3], ['aes encryption', 3],
    ['hash function', 2], ['digital signature', 3], ['ssl tls', 3],
    ['zero day exploit', 3], ['buffer overflow', 3], ['privilege escalation', 3],
    ['firewall', 2], ['intrusion detection', 3], ['siem', 3],
    ['owasp', 3], ['cvss score', 3], ['cve', 2],
    ['network forensics', 3], ['malware analysis', 3], ['reverse engineering', 3],
    ['oscp', 3], ['ceh', 3], ['cissp', 3],
    ['encryption', 2], ['decryption', 2], ['authentication', 2],
    ['authorization', 2], ['security', 1], ['hacking', 1], ['exploit', 2],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  computer_science: [
    'hook', 'prior_knowledge_bridge', 'concept', 'architecture_overview',
    'code_walkthrough', 'worked_example', 'visual', 'best_practice',
    'common_mistake', 'real_world_application', 'result',
  ],
  data_science: [
    'hook', 'problem_framing', 'concept', 'mathematical_foundation',
    'algorithm_walkthrough', 'code_example', 'visual',
    'evaluation_metrics', 'common_pitfall', 'real_world_application', 'result',
  ],
  cybersecurity: [
    'threat_scenario', 'concept', 'attack_walkthrough', 'defense_mechanism',
    'hands_on_demo', 'visual', 'best_practice', 'real_world_case', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  computer_science: `
ANIMATION STRATEGY — COMPUTER SCIENCE:
  Primitives: rect (components), arrow (data flow), circle (services), codeline (code)
  Layout rules:
    - OS: layered rects.
    - Web: client→server→database rects.
  MINIMUM STEPS: OS=12 | networking=12
`,
  data_science: `
ANIMATION STRATEGY — DATA SCIENCE & ML:
  Primitives: axes, dot, circle, arrow, rect, codeline
  Layout rules:
    - Plots: SINGLE 'axes' in center with scattered 'dot' elements.
    - Neural Net: circle nodes in column layers.
  MINIMUM STEPS: plotting=8 | neural net=14
`,
  cybersecurity: `
ANIMATION STRATEGY — CYBERSECURITY:
  Primitives: rect (systems), arrow (attack vector), circle (actors), badge (CVE)
  Layout rules:
    - Attack Chain: sequential rect steps.
    - Network diagram: circle nodes, red arrow = attack.
  MINIMUM STEPS: attack chain=12 | network=12
`,
};
export const DOMAIN_MIN_STEPS = {
  computer_science: { os: 12, network: 12, database: 10, oop: 10, web: 10, distributed: 14, default: 10 },
  data_science: { neural: 14, train: 12, tree: 10, eval: 8, default: 10 },
  cybersecurity: { attack: 12, network: 12, crypto: 10, auth: 10, threat: 10, default: 10 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {};
