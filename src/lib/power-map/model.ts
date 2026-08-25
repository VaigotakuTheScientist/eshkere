/**
 * AI Safety Power Map — the semantic model.
 *
 * One node/edge graph. Every lens is a selection over it, never a second
 * dataset: `docs/ai-safety-power-map.md` §2 is explicit that Tier 1, people,
 * organizations and the supply chain must not become datasets that can
 * disagree with each other.
 *
 * Nothing here describes how the map is drawn. Rows, columns and colours live
 * in `layout.ts`; this file is what a matrix, a table or a timeline over the
 * same actors would read instead.
 */

/** What kind of decision centre a node is. The distinction is load-bearing. */
export type ActorType =
  | 'organization'
  | 'state'
  | 'government-body'
  | 'governance-body'
  | 'infrastructure'
  | 'person';

/**
 * Provisional power tier (brief §5). Deliberately coarse, and deliberately
 * not a score: `tier + power vector` beats one number, and Core is not the
 * Tier 1 filter.
 */
export type Tier = 'tier-1' | 'tier-2' | 'tier-3' | 'contextual';

/** The levers that actually determine the trajectory (brief §4). */
export type Lever =
  | 'model development'
  | 'deployment'
  | 'compute allocation'
  | 'physical infrastructure'
  | 'capital / ownership'
  | 'talent'
  | 'regulation / coercion'
  | 'procurement'
  | 'evaluation / standards'
  | 'coordination'
  | 'agenda / information'
  | 'veto / delay';

/** Typed relationships (brief §6). Edges are knowledge, not decoration. */
export type EdgeType =
  | 'executive authority'
  | 'governance'
  | 'cloud / compute'
  | 'accelerators'
  | 'manufacturing'
  | 'equipment supply'
  | 'memory supply'
  | 'energy / grid'
  | 'regulates / constrains'
  | 'evaluates / informs';

/**
 * The conceptual arenas of the layered dependency network, top to bottom
 * (brief §12). An arena is semantic — where in the stack an actor sits — and
 * the renderer happens to draw arenas as rows.
 */
export type Arena = 'state' | 'authority' | 'developers' | 'cloud' | 'silicon' | 'energy';

export interface Source {
  label: string;
  url: string;
}

export interface Actor {
  id: string;
  label: string;
  /** For nodes whose full name is too long to sit in a box. */
  shortLabel?: string;
  type: ActorType;
  tier: Tier;
  arena: Arena;
  /**
   * The institution this node is *inside*. Semantic zoom collapses a child
   * into its parent rather than duplicating the fact into two map objects
   * (brief §3): Sam Altman is not a second OpenAI, he is OpenAI expanded.
   */
  parent?: string;
  /**
   * Keep this node in Core even when its tier alone would not earn a place.
   * Core is the smallest *useful system view*, and a Tier-1-only map hides
   * exactly the chokepoints that make the system what it is.
   */
  corePath?: boolean;
  levers: Lever[];
  /** Why this actor is on the map at all, in one or two sentences. */
  rationale: string;
  /** What this actor can actually do — the specific levers, in plain words. */
  powerLevers: string[];
  sources: Source[];
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  /** Which of the twelve levers this dependency acts on. */
  levers: Lever[];
  /** How much of the trajectory moves if this relationship changes. */
  strength: 'major' | 'supporting';
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

/* ------------------------------------------------------------------ actors */

/**
 * The public-safe snapshot. The structured source of truth is the Notion
 * databases named in `docs/ai-safety-power-map.md` §8; this is the curated
 * export of it that is safe to publish, and it is deliberately static.
 *
 * Roles are stated as of the snapshot date, not as timeless facts. Sources
 * are official public presences: they evidence that an actor is what the map
 * says it is, at the coarse level the map claims, and nothing finer.
 */
export const SNAPSHOT_DATE = '2026-08-25';

export const actors: Actor[] = [
  /* ------------------------------------------------- state / regulation */
  {
    id: 'us-federal',
    label: 'United States federal government',
    shortLabel: 'United States',
    type: 'state',
    tier: 'tier-1',
    arena: 'state',
    corePath: true,
    levers: ['regulation / coercion', 'procurement', 'veto / delay', 'coordination'],
    rationale:
      'Jurisdiction over most of the frontier developer and accelerator base, and over the export of the accelerators everyone else depends on. Expand it and the authority turns out to sit in specific agencies rather than in "the US".',
    powerLevers: [
      'Export controls on accelerators and semiconductor equipment',
      'Procurement as a very large customer',
      'Permitting and grid authority over frontier-scale sites',
    ],
    sources: [{ label: 'whitehouse.gov', url: 'https://www.whitehouse.gov/' }],
  },
  {
    id: 'bis',
    label: 'U.S. Bureau of Industry and Security',
    shortLabel: 'BIS',
    type: 'government-body',
    tier: 'tier-1',
    arena: 'state',
    parent: 'us-federal',
    corePath: true,
    levers: ['regulation / coercion', 'veto / delay'],
    rationale:
      'Administers the export controls that decide which accelerators may be sold where. One of the clearest places where a single administrative body conditions frontier compute access.',
    powerLevers: [
      'Entity list and licence decisions',
      'Performance thresholds on exportable accelerators',
    ],
    sources: [{ label: 'bis.gov', url: 'https://www.bis.gov/' }],
  },
  {
    id: 'doe-oe',
    label: 'U.S. DOE Office of Electricity',
    shortLabel: 'DOE-OE',
    type: 'government-body',
    tier: 'tier-2',
    arena: 'state',
    parent: 'us-federal',
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'Sits on the grid side of the compute stack, where transmission and interconnection decide how quickly a frontier-scale site can actually draw power.',
    powerLevers: ['Transmission and interconnection policy', 'Grid reliability authorities'],
    sources: [
      { label: 'energy.gov/oe', url: 'https://www.energy.gov/oe/office-electricity' },
    ],
  },
  {
    id: 'china-governance',
    label: 'China — central AI governance and industrial apparatus',
    shortLabel: 'China',
    type: 'state',
    tier: 'tier-1',
    arena: 'state',
    corePath: true,
    levers: ['regulation / coercion', 'capital / ownership', 'coordination', 'agenda / information'],
    rationale:
      'Sets the terms for one of the two frontier developer ecosystems, and is the counterparty that most shapes how the other one is governed.',
    powerLevers: [
      'Approval and licensing of model release',
      'Industrial policy and domestic accelerator programmes',
    ],
    sources: [{ label: 'cac.gov.cn', url: 'https://www.cac.gov.cn/' }],
  },
  {
    id: 'eu-ai-office',
    label: 'European Commission / EU AI Office',
    shortLabel: 'EU AI Office',
    type: 'government-body',
    tier: 'tier-2',
    arena: 'state',
    corePath: true,
    levers: ['regulation / coercion', 'evaluation / standards'],
    rationale:
      'The most developed binding regime aimed specifically at general-purpose models, and therefore a live constraint on how frontier systems are deployed into a large market.',
    powerLevers: [
      'General-purpose model obligations',
      'Codes of practice and enforcement',
    ],
    sources: [
      {
        label: 'EU AI Office',
        url: 'https://digital-strategy.ec.europa.eu/en/policies/ai-office',
      },
    ],
  },
  {
    id: 'uk-aisi',
    label: 'UK AI Security Institute',
    shortLabel: 'UK AISI',
    type: 'government-body',
    tier: 'tier-3',
    arena: 'state',
    levers: ['evaluation / standards', 'agenda / information'],
    rationale:
      'Evaluation capacity rather than authority. Its power is epistemic: what it measures becomes what the debate is about.',
    powerLevers: ['Pre-deployment evaluations', 'Public technical reporting'],
    sources: [{ label: 'aisi.gov.uk', url: 'https://www.aisi.gov.uk/' }],
  },

  /* --------------------------------- people and internal governance */
  {
    id: 'openai-foundation-board',
    label: 'OpenAI Foundation Board',
    type: 'governance-body',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'openai',
    levers: ['veto / delay', 'capital / ownership', 'deployment'],
    rationale:
      'Appointment and removal authority over OpenAI leadership. Expanding OpenAI is what shows that some decisions are the board’s and not the executive’s.',
    powerLevers: ['Appoints and removes leadership', 'Structural and mission constraints'],
    sources: [{ label: 'openai.com', url: 'https://openai.com/' }],
  },
  {
    id: 'anthropic-ltbt',
    label: 'Anthropic Long-Term Benefit Trust',
    shortLabel: 'Anthropic LTBT',
    type: 'governance-body',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'anthropic',
    levers: ['veto / delay', 'capital / ownership'],
    rationale:
      'Holds board-appointment rights designed to survive commercial pressure. A governance instrument, not an advisory body.',
    powerLevers: ['Elects a portion of the board', 'Mission-protective structure'],
    sources: [
      {
        label: 'The Long-Term Benefit Trust',
        url: 'https://www.anthropic.com/news/the-long-term-benefit-trust',
      },
    ],
  },
  {
    id: 'sam-altman',
    label: 'Sam Altman',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'openai',
    levers: ['model development', 'deployment', 'capital / ownership', 'agenda / information'],
    rationale:
      'Executive authority over OpenAI as of the snapshot date, and one of the loudest voices setting the public agenda about what is coming.',
    powerLevers: ['Deployment and release timing', 'Capital and compute deals'],
    sources: [{ label: 'openai.com', url: 'https://openai.com/' }],
  },
  {
    id: 'dario-amodei',
    label: 'Dario Amodei',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'anthropic',
    levers: ['model development', 'deployment', 'agenda / information'],
    rationale:
      'Executive authority over Anthropic as of the snapshot date, and a primary author of the public case for treating scaling as a safety problem.',
    powerLevers: ['Deployment and release timing', 'Public risk framing'],
    sources: [{ label: 'anthropic.com', url: 'https://www.anthropic.com/' }],
  },
  {
    id: 'demis-hassabis',
    label: 'Demis Hassabis',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'google-deepmind',
    levers: ['model development', 'deployment', 'talent'],
    rationale:
      'Executive authority over Google DeepMind as of the snapshot date, inside a parent company with its own compute and distribution.',
    powerLevers: ['Research direction', 'Release posture within Google'],
    sources: [{ label: 'deepmind.google', url: 'https://deepmind.google/' }],
  },
  {
    id: 'mark-zuckerberg',
    label: 'Mark Zuckerberg',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'meta',
    levers: ['model development', 'deployment', 'capital / ownership'],
    rationale:
      'Controlling authority over Meta as of the snapshot date, including the decision to release frontier-adjacent weights openly.',
    powerLevers: ['Open-weight release decisions', 'Capital allocation at scale'],
    sources: [{ label: 'ai.meta.com', url: 'https://ai.meta.com/' }],
  },
  {
    id: 'elon-musk',
    label: 'Elon Musk',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'spacexai',
    levers: ['model development', 'capital / ownership', 'agenda / information', 'physical infrastructure'],
    rationale:
      'Controlling authority as of the snapshot date, with unusual ability to move capital and physical build-out quickly.',
    powerLevers: ['Capital and site build-out speed', 'Public agenda setting'],
    sources: [{ label: 'x.ai', url: 'https://x.ai/' }],
  },
  {
    id: 'jensen-huang',
    label: 'Jensen Huang',
    type: 'person',
    tier: 'tier-1',
    arena: 'authority',
    parent: 'nvidia',
    levers: ['compute allocation', 'agenda / information'],
    rationale:
      'Executive authority over the company that allocates the scarcest input in the stack. Who gets accelerators, and when, is partly a commercial decision.',
    powerLevers: ['Allocation and roadmap decisions', 'Pricing and supply commitments'],
    sources: [{ label: 'nvidia.com', url: 'https://www.nvidia.com/' }],
  },

  /* ------------------------------------------- frontier developers */
  {
    id: 'openai',
    label: 'OpenAI',
    type: 'organization',
    tier: 'tier-1',
    arena: 'developers',
    corePath: true,
    levers: ['model development', 'deployment', 'compute allocation', 'agenda / information'],
    rationale:
      'A frontier developer whose release decisions move the whole field’s expectations. Expand it and the authority splits between the executive and the foundation board.',
    powerLevers: ['Frontier training runs', 'Release and access policy'],
    sources: [{ label: 'openai.com', url: 'https://openai.com/' }],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    type: 'organization',
    tier: 'tier-1',
    arena: 'developers',
    corePath: true,
    levers: ['model development', 'deployment', 'evaluation / standards'],
    rationale:
      'A frontier developer that also supplies much of the public safety framing. Expand it and a trust holds part of the board authority.',
    powerLevers: ['Frontier training runs', 'Responsible-scaling commitments'],
    sources: [{ label: 'anthropic.com', url: 'https://www.anthropic.com/' }],
  },
  {
    id: 'google-deepmind',
    label: 'Google DeepMind / Google',
    shortLabel: 'Google DeepMind',
    type: 'organization',
    tier: 'tier-1',
    arena: 'developers',
    corePath: true,
    levers: ['model development', 'deployment', 'compute allocation', 'talent'],
    rationale:
      'A frontier developer inside a company that owns its own compute and one of the largest distribution surfaces in existence.',
    powerLevers: ['Frontier training runs', 'Own accelerators and cloud', 'Default distribution'],
    sources: [{ label: 'deepmind.google', url: 'https://deepmind.google/' }],
  },
  {
    id: 'meta',
    label: 'Meta',
    type: 'organization',
    tier: 'tier-1',
    arena: 'developers',
    corePath: true,
    levers: ['model development', 'deployment', 'physical infrastructure'],
    rationale:
      'Sets the open-weight frontier, which changes what every other actor’s deployment decisions are competing against.',
    powerLevers: ['Open-weight releases', 'Very large owned build-out'],
    sources: [{ label: 'ai.meta.com', url: 'https://ai.meta.com/' }],
  },
  {
    id: 'spacexai',
    label: 'SpaceXAI',
    type: 'organization',
    tier: 'tier-1',
    arena: 'developers',
    corePath: true,
    levers: ['model development', 'physical infrastructure', 'capital / ownership'],
    rationale:
      'A frontier developer distinguished less by model lead than by how fast it can put compute and power on the ground.',
    powerLevers: ['Rapid site build-out', 'Capital concentration'],
    sources: [{ label: 'x.ai', url: 'https://x.ai/' }],
  },
  {
    id: 'alibaba',
    label: 'Alibaba / Alibaba Cloud / Qwen',
    shortLabel: 'Alibaba',
    type: 'organization',
    tier: 'tier-2',
    arena: 'developers',
    levers: ['model development', 'deployment', 'compute allocation'],
    rationale:
      'Both a developer and a cloud, which makes it one of the few actors outside the US stack that controls several layers at once.',
    powerLevers: ['Open-weight model releases', 'Regional cloud capacity'],
    sources: [{ label: 'alibabacloud.com', url: 'https://www.alibabacloud.com/' }],
  },
  {
    id: 'bytedance',
    label: 'ByteDance / Seed',
    shortLabel: 'ByteDance',
    type: 'organization',
    tier: 'tier-2',
    arena: 'developers',
    levers: ['model development', 'deployment', 'talent'],
    rationale:
      'Very large distribution and a well-resourced research effort, developing under a different regulatory regime.',
    powerLevers: ['Consumer-scale deployment', 'Talent concentration'],
    sources: [{ label: 'bytedance.com', url: 'https://www.bytedance.com/' }],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'organization',
    tier: 'tier-2',
    arena: 'developers',
    levers: ['model development', 'deployment'],
    rationale:
      'Demonstrated that frontier-adjacent capability can arrive from outside the assumed set of actors, which is itself a fact about how controllable the frontier is.',
    powerLevers: ['Efficient training results', 'Open-weight releases'],
    sources: [{ label: 'deepseek.com', url: 'https://www.deepseek.com/' }],
  },

  /* ---------------------------------------------------- cloud / compute */
  {
    id: 'microsoft-azure',
    label: 'Microsoft / Azure',
    shortLabel: 'Microsoft / Azure',
    type: 'organization',
    tier: 'tier-1',
    arena: 'cloud',
    corePath: true,
    levers: ['compute allocation', 'capital / ownership', 'deployment'],
    rationale:
      'Supplies the compute a frontier developer trains on, which makes a commercial relationship into a dependency on someone else’s capacity plan.',
    powerLevers: ['Capacity allocation and scheduling', 'Enterprise distribution'],
    sources: [{ label: 'azure.microsoft.com', url: 'https://azure.microsoft.com/' }],
  },
  {
    id: 'aws',
    label: 'Amazon / AWS',
    shortLabel: 'Amazon / AWS',
    type: 'organization',
    tier: 'tier-1',
    arena: 'cloud',
    corePath: true,
    levers: ['compute allocation', 'capital / ownership'],
    rationale:
      'Supplies frontier training and serving capacity to more than one developer, which makes it a shared dependency rather than a private arrangement.',
    powerLevers: ['Capacity allocation', 'Own accelerator programme'],
    sources: [{ label: 'aws.amazon.com', url: 'https://aws.amazon.com/' }],
  },

  /* ------------------------- accelerators / memory / manufacturing */
  {
    id: 'nvidia',
    label: 'NVIDIA',
    type: 'organization',
    tier: 'tier-1',
    arena: 'silicon',
    corePath: true,
    levers: ['compute allocation', 'model development'],
    rationale:
      'The single most concentrated point in the stack: nearly every frontier training run depends on its accelerators, and allocation is discretionary.',
    powerLevers: ['Who receives accelerators, and when', 'Roadmap and interconnect'],
    sources: [{ label: 'nvidia.com', url: 'https://www.nvidia.com/' }],
  },
  {
    id: 'tsmc',
    label: 'TSMC',
    type: 'organization',
    tier: 'tier-1',
    arena: 'silicon',
    corePath: true,
    levers: ['compute allocation', 'physical infrastructure'],
    rationale:
      'Manufactures the accelerators. A chokepoint that is geographically concentrated as well as technically concentrated.',
    powerLevers: ['Leading-node capacity', 'Advanced packaging'],
    sources: [{ label: 'tsmc.com', url: 'https://www.tsmc.com/' }],
  },
  {
    id: 'asml',
    label: 'ASML',
    type: 'organization',
    tier: 'tier-2',
    arena: 'silicon',
    // Not globally Tier 1, and exactly the kind of node a Tier-1 filter would
    // drop: the brief names it as the reason Core must not be that filter.
    corePath: true,
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'Sole supplier of the lithography needed for leading-node manufacturing. Its power is almost entirely structural rather than agenda-setting.',
    powerLevers: ['EUV tool supply', 'Servicing and upgrade dependence'],
    sources: [{ label: 'asml.com', url: 'https://www.asml.com/' }],
  },
  {
    id: 'sk-hynix',
    label: 'SK hynix',
    type: 'organization',
    tier: 'tier-2',
    arena: 'silicon',
    corePath: true,
    levers: ['compute allocation'],
    rationale:
      'High-bandwidth memory is a real constraint on accelerator output, and the supplier base for it is small.',
    powerLevers: ['HBM capacity and qualification'],
    sources: [{ label: 'skhynix.com', url: 'https://www.skhynix.com/' }],
  },

  /* -------------------------------------- energy / grid / physical site */
  {
    id: 'sb-energy',
    label: 'SB Energy',
    type: 'infrastructure',
    tier: 'contextual',
    arena: 'energy',
    corePath: true,
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'Site-specific generation and storage for frontier-scale compute. Little global agenda power, considerable leverage over one build.',
    powerLevers: ['Generation and storage at a specific site'],
    sources: [{ label: 'sbenergycorp.com', url: 'https://www.sbenergycorp.com/' }],
  },
  {
    id: 'entergy-louisiana',
    label: 'Entergy Louisiana',
    type: 'infrastructure',
    tier: 'contextual',
    arena: 'energy',
    corePath: true,
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'The utility on the other side of a specific frontier-scale interconnection. Contextual power that is decisive locally and invisible globally.',
    powerLevers: ['Interconnection timing', 'Generation commitments'],
    sources: [{ label: 'entergy-louisiana.com', url: 'https://www.entergy-louisiana.com/' }],
  },
  {
    id: 'tva',
    label: 'Tennessee Valley Authority',
    shortLabel: 'TVA',
    type: 'infrastructure',
    tier: 'contextual',
    arena: 'energy',
    corePath: true,
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'A federal power producer whose supply decisions condition specific frontier-compute sites.',
    powerLevers: ['Bulk power supply', 'Transmission commitments'],
    sources: [{ label: 'tva.com', url: 'https://www.tva.com/' }],
  },
  {
    id: 'mlgw',
    label: 'Memphis Light, Gas and Water',
    shortLabel: 'MLGW',
    type: 'infrastructure',
    tier: 'contextual',
    arena: 'energy',
    corePath: true,
    levers: ['physical infrastructure', 'veto / delay'],
    rationale:
      'A municipal utility with real veto and delay leverage over one particular site — the clearest case that power here is contextual rather than global.',
    powerLevers: ['Local interconnection and permitting', 'Delay'],
    sources: [{ label: 'mlgw.com', url: 'https://www.mlgw.com/' }],
  },
];

/* ----------------------------------------------------------- relationships */

/**
 * The typed dependencies named in `docs/ai-safety-power-map.md` §8, plus the
 * executive-authority edges the same section implies for the six modelled
 * individuals. The research snapshot holds 24; the public brief names these,
 * and nothing is invented to reach a count.
 */
export const relationships: Relationship[] = [
  // --- governance
  {
    id: 'openai-board-governs-openai',
    from: 'openai-foundation-board',
    to: 'openai',
    type: 'governance',
    levers: ['veto / delay', 'capital / ownership'],
    strength: 'major',
    rationale: 'Appointment and removal authority over leadership.',
    confidence: 'high',
  },
  {
    id: 'ltbt-governs-anthropic',
    from: 'anthropic-ltbt',
    to: 'anthropic',
    type: 'governance',
    levers: ['veto / delay'],
    strength: 'major',
    rationale: 'Holds rights to elect part of the board.',
    confidence: 'high',
  },
  // --- executive authority
  {
    id: 'altman-runs-openai',
    from: 'sam-altman',
    to: 'openai',
    type: 'executive authority',
    levers: ['deployment', 'model development'],
    strength: 'major',
    rationale: 'Executive authority as of the snapshot date.',
    confidence: 'high',
  },
  {
    id: 'amodei-runs-anthropic',
    from: 'dario-amodei',
    to: 'anthropic',
    type: 'executive authority',
    levers: ['deployment', 'model development'],
    strength: 'major',
    rationale: 'Executive authority as of the snapshot date.',
    confidence: 'high',
  },
  {
    id: 'hassabis-runs-gdm',
    from: 'demis-hassabis',
    to: 'google-deepmind',
    type: 'executive authority',
    levers: ['model development'],
    strength: 'major',
    rationale: 'Executive authority as of the snapshot date.',
    confidence: 'high',
  },
  {
    id: 'zuckerberg-runs-meta',
    from: 'mark-zuckerberg',
    to: 'meta',
    type: 'executive authority',
    levers: ['deployment', 'capital / ownership'],
    strength: 'major',
    rationale: 'Controlling authority as of the snapshot date.',
    confidence: 'high',
  },
  {
    id: 'musk-runs-spacexai',
    from: 'elon-musk',
    to: 'spacexai',
    type: 'executive authority',
    levers: ['capital / ownership', 'physical infrastructure'],
    strength: 'major',
    rationale: 'Controlling authority as of the snapshot date.',
    confidence: 'high',
  },
  {
    id: 'huang-runs-nvidia',
    from: 'jensen-huang',
    to: 'nvidia',
    type: 'executive authority',
    levers: ['compute allocation'],
    strength: 'major',
    rationale: 'Executive authority as of the snapshot date.',
    confidence: 'high',
  },
  // --- cloud / compute
  {
    id: 'azure-computes-openai',
    from: 'microsoft-azure',
    to: 'openai',
    type: 'cloud / compute',
    levers: ['compute allocation'],
    strength: 'major',
    rationale: 'Training and serving capacity for frontier runs.',
    confidence: 'high',
  },
  {
    id: 'aws-computes-anthropic',
    from: 'aws',
    to: 'anthropic',
    type: 'cloud / compute',
    levers: ['compute allocation'],
    strength: 'major',
    rationale: 'Training and serving capacity for frontier runs.',
    confidence: 'high',
  },
  {
    id: 'aws-computes-openai',
    from: 'aws',
    to: 'openai',
    type: 'cloud / compute',
    levers: ['compute allocation'],
    strength: 'major',
    rationale:
      'A second cloud counterparty — and the reason this supplier sits on more than one frontier path at once.',
    confidence: 'medium',
  },
  // --- silicon
  {
    id: 'asml-equips-tsmc',
    from: 'asml',
    to: 'tsmc',
    type: 'equipment supply',
    levers: ['physical infrastructure'],
    strength: 'major',
    rationale: 'Lithography without which leading-node manufacturing does not happen.',
    confidence: 'high',
  },
  {
    id: 'tsmc-makes-nvidia',
    from: 'tsmc',
    to: 'nvidia',
    type: 'manufacturing',
    levers: ['compute allocation'],
    strength: 'major',
    rationale: 'Manufactures the accelerators, including advanced packaging.',
    confidence: 'high',
  },
  {
    id: 'skhynix-memory-nvidia',
    from: 'sk-hynix',
    to: 'nvidia',
    type: 'memory supply',
    levers: ['compute allocation'],
    strength: 'major',
    rationale: 'High-bandwidth memory constrains accelerator output.',
    confidence: 'high',
  },
  {
    id: 'nvidia-accelerates-meta',
    from: 'nvidia',
    to: 'meta',
    type: 'accelerators',
    levers: ['compute allocation', 'model development'],
    strength: 'major',
    rationale: 'Accelerator supply for very large owned build-out.',
    confidence: 'high',
  },
  {
    id: 'nvidia-accelerates-spacexai',
    from: 'nvidia',
    to: 'spacexai',
    type: 'accelerators',
    levers: ['compute allocation', 'model development'],
    strength: 'major',
    rationale: 'Accelerator supply for rapid site build-out.',
    confidence: 'high',
  },
  // --- energy
  {
    id: 'sbenergy-powers-openai',
    from: 'sb-energy',
    to: 'openai',
    type: 'energy / grid',
    levers: ['physical infrastructure', 'veto / delay'],
    strength: 'major',
    rationale: 'Site generation and storage for frontier-scale compute.',
    confidence: 'medium',
  },
  {
    id: 'entergy-powers-meta',
    from: 'entergy-louisiana',
    to: 'meta',
    type: 'energy / grid',
    levers: ['physical infrastructure', 'veto / delay'],
    strength: 'major',
    rationale: 'Utility counterparty for a specific frontier-scale interconnection.',
    confidence: 'medium',
  },
  {
    id: 'tva-powers-spacexai',
    from: 'tva',
    to: 'spacexai',
    type: 'energy / grid',
    levers: ['physical infrastructure'],
    strength: 'major',
    rationale: 'Bulk power supply to a specific site.',
    confidence: 'medium',
  },
  {
    id: 'mlgw-powers-spacexai',
    from: 'mlgw',
    to: 'spacexai',
    type: 'energy / grid',
    levers: ['physical infrastructure', 'veto / delay'],
    strength: 'major',
    rationale:
      'Local interconnection and permitting for the same site — little global power, decisive locally.',
    confidence: 'medium',
  },
  // --- regulation
  {
    id: 'bis-constrains-nvidia',
    from: 'bis',
    to: 'nvidia',
    type: 'regulates / constrains',
    levers: ['regulation / coercion', 'veto / delay'],
    strength: 'major',
    rationale: 'Export controls decide which accelerators may be sold where.',
    confidence: 'high',
  },
  {
    id: 'eu-constrains-openai',
    from: 'eu-ai-office',
    to: 'openai',
    type: 'regulates / constrains',
    levers: ['regulation / coercion', 'deployment'],
    strength: 'supporting',
    rationale: 'General-purpose model obligations condition deployment into the EU.',
    confidence: 'high',
  },
  {
    id: 'eu-constrains-anthropic',
    from: 'eu-ai-office',
    to: 'anthropic',
    type: 'regulates / constrains',
    levers: ['regulation / coercion', 'deployment'],
    strength: 'supporting',
    rationale: 'General-purpose model obligations condition deployment into the EU.',
    confidence: 'high',
  },
];

/* ------------------------------------------------------------------ lookup */

export const actorById = new Map(actors.map((actor) => [actor.id, actor]));

/** Children of each expandable institution, in authored order. */
export const childrenOf = ((): Map<string, Actor[]> => {
  const map = new Map<string, Actor[]>();
  for (const actor of actors) {
    if (!actor.parent) continue;
    const list = map.get(actor.parent) ?? [];
    list.push(actor);
    map.set(actor.parent, list);
  }
  return map;
})();

/** Institutions that have something to reveal. */
export const expandable = actors.filter((actor) => childrenOf.has(actor.id));
