import type { CareModule, Supply } from './model';

const hairInventory = [
  { id: 'comb', title: 'Wide-tooth comb', kind: 'Equipment' },
  { id: 'shampoo', title: 'Shampoo', kind: 'Product' },
  { id: 'conditioner', title: 'Rinse-out conditioner', kind: 'Product' },
  { id: 'towel', title: 'Soft towel or T-shirt', kind: 'Equipment' },
] as const satisfies readonly Supply[];

const hair = {
  id: 'hair',
  title: 'Hair',
  subtitle: 'Detangle with care, choose a wash rhythm and play with shape.',
  inventory: hairInventory,
  routines: [
    {
      id: 'morning', timing: 'When you get ready', steps: [
        {
          id: 'inspect', title: 'Check texture and tangles', kind: 'core',
          action: 'Look for tangles and see how your hair is sitting.',
          why: 'A quick check helps you decide whether to leave your hair alone, detangle it or refresh the shape.',
          basis: 'preference',
        },
        {
          id: 'refresh', title: 'Refresh the shape', kind: 'optional',
          action: 'Lightly dampen sections and reshape with your fingers.',
          why: 'Try this if you prefer a tidier shape between washes. How well it works depends on your texture.',
          basis: 'preference',
        },
      ],
    },
    {
      id: 'evening', timing: 'Before bed', steps: [
        {
          id: 'release', title: 'Loosen a tight style', kind: 'conditional',
          action: 'Release styles that pull or feel uncomfortable.',
          why: 'Repeated tension can damage hair. Loosening a tight style reduces pulling.',
          basis: 'guidance', source: 'styling',
        },
      ],
    },
    {
      id: 'periodic', timing: 'On wash day', steps: [
        {
          id: 'wash', title: 'Wash the scalp', kind: 'core',
          action: 'Massage shampoo into your scalp, then rinse.',
          why: 'Shampoo lifts oil and product buildup. Concentrating it on the scalp avoids unnecessary washing along the lengths.',
          basis: 'guidance', source: 'hair', supplies: ['shampoo'],
        },
        {
          id: 'condition', title: 'Condition the lengths', kind: 'core',
          action: 'Apply conditioner where your hair needs slip, then rinse.',
          why: 'Conditioner helps smooth strands and makes them easier to detangle.',
          basis: 'guidance', source: 'hair', supplies: ['conditioner'],
        },
        {
          id: 'dry', title: 'Blot and dry gently', kind: 'core',
          action: 'Blot with a soft towel and air-dry or use low heat.',
          why: 'Blotting avoids rough rubbing. Less heat exposure helps limit damage.',
          basis: 'guidance', source: 'hair', supplies: ['towel'],
        },
      ],
    },
    {
      id: 'as-needed', timing: 'When tangles get in the way', steps: [
        {
          id: 'detangle', title: 'Detangle from the ends', kind: 'conditional',
          action: 'Use a wide-tooth comb gently, starting at the ends.',
          why: 'Working up gradually helps loosen knots without pulling through them. Dampness and conditioner may help, depending on your texture.',
          precaution: 'Pause if the comb catches or your scalp hurts. How wet to work depends on your hair texture.',
          basis: 'guidance', source: 'hair', supplies: ['comb'],
        },
      ],
    },
  ],
  experiment: {
    id: 'hair-detangling', title: 'Detangling technique',
    hypothesis: 'Dividing my hair into sections will make detangling feel easier.',
    variable: 'Sectioned detangling versus my usual technique.',
    prompt: 'Compare how easy the technique was to use and whether you would repeat it.',
    stop: 'Stop if you feel pain or need to pull hard.',
  },
  escalation: 'Ask a dermatologist about persistent scalp irritation or unexpected hair loss.',
} satisfies CareModule<(typeof hairInventory)[number]['id']>;

const nailInventory = [
  { id: 'cream', title: 'Hand moisturizer', kind: 'Product' },
  { id: 'clippers', title: 'Nail clippers', kind: 'Equipment' },
  { id: 'file', title: 'Emery board', kind: 'Equipment' },
  { id: 'polish', title: 'Regular polish and coats', kind: 'Product' },
  { id: 'remover', title: 'Regular polish remover', kind: 'Product' },
] as const satisfies readonly Supply[];

const nails = {
  id: 'nails',
  title: 'Nails',
  subtitle: 'Care for your hands and nails, with room to try a finish you like.',
  inventory: nailInventory,
  routines: [
    {
      id: 'morning', timing: 'After washing your hands', steps: [
        {
          id: 'clean', title: 'Dry around the nails', kind: 'core',
          action: 'Dry your fingertips and around the nails after washing.',
          why: 'Keeping nails clean and dry is a basic part of nail hygiene.',
          basis: 'guidance', source: 'nails',
        },
      ],
    },
    {
      id: 'evening', timing: 'After your last hand wash', steps: [
        {
          id: 'moisturize', title: 'Moisturize hands and nails', kind: 'core',
          action: 'Massage a hand moisturizer around the nails and cuticles.',
          why: 'Moisturizing after washing helps with dryness.',
          basis: 'guidance', source: 'nails', supplies: ['cream'],
        },
      ],
    },
    {
      id: 'periodic', timing: 'When you want to trim or polish', steps: [
        {
          id: 'shape', title: 'Trim and smooth the edges', kind: 'conditional',
          action: 'Trim fingernails almost straight across and file snags.',
          why: 'Smooth edges are less likely to catch on fabric.',
          precaution: 'Leave cuticles intact. Avoid cutting or forcing them back.',
          basis: 'guidance', source: 'nails', supplies: ['clippers', 'file'],
        },
        {
          id: 'polish', title: 'Try a clear or colored finish', kind: 'optional',
          action: 'For ordinary polish, follow the label for base, color or clear polish, and top coat.',
          why: 'The finish is a style choice. Compare what you like on your own hands.',
          precaution: 'Use ordinary polish as directed and stop if it irritates your skin.',
          basis: 'preference', supplies: ['polish'],
        },
      ],
    },
    {
      id: 'as-needed', timing: 'When you want to remove polish', steps: [
        {
          id: 'remove', title: 'Remove regular polish', kind: 'conditional',
          action: 'Follow the remover label, then moisturize.',
          why: 'Polish remover can dry out the nails. Moisturizing afterward helps with dryness.',
          precaution: 'Avoid scraping or peeling the polish off.',
          basis: 'guidance', source: 'manicure', supplies: ['remover', 'cream'],
        },
      ],
    },
  ],
  experiment: {
    id: 'nails-finish', title: 'Clear versus color',
    hypothesis: 'I will prefer a clear finish for everyday wear.',
    variable: 'Clear versus colored regular polish, with the same prep.',
    prompt: 'Compare how each finish looks to you and how much upkeep it takes.',
    stop: 'Stop if a product causes irritation or discomfort.',
  },
  escalation: 'Ask a dermatologist about unexplained nail changes, swelling or pain.',
} satisfies CareModule<(typeof nailInventory)[number]['id']>;

const faceInventory = [
  { id: 'cleanser', title: 'Gentle cleanser', kind: 'Product' },
  { id: 'moisturizer', title: 'Face moisturizer', kind: 'Product' },
  { id: 'sunscreen', title: 'Broad-spectrum SPF 30+ sunscreen', kind: 'Product' },
  { id: 'towel', title: 'Soft face towel', kind: 'Equipment' },
] as const satisfies readonly Supply[];

const face = {
  id: 'face',
  title: 'Face',
  subtitle: 'Start with gentle cleansing, moisturizer and sun protection.',
  inventory: faceInventory,
  routines: [
    {
      id: 'morning', timing: 'Before heading out', steps: [
        {
          id: 'morning-cleanse', title: 'Cleanse gently', kind: 'core',
          action: 'Use a gentle cleanser and lukewarm water. Pat dry.',
          why: 'Gentle washing removes surface buildup. Scrubbing can irritate the skin.',
          basis: 'guidance', source: 'face', supplies: ['cleanser', 'towel'],
        },
        {
          id: 'morning-moisturize', title: 'Apply moisturizer', kind: 'core',
          action: 'Smooth moisturizer over skin that is still slightly damp.',
          why: 'Moisturizer helps hold water in the skin.',
          basis: 'guidance', source: 'skin', supplies: ['moisturizer'],
        },
        {
          id: 'protect', title: 'Apply sunscreen', kind: 'core',
          action: 'Before going outdoors, use broad-spectrum, water-resistant SPF 30 or higher on exposed skin.',
          why: 'Sunscreen helps protect against ultraviolet rays. Include the ears and neck if they are exposed.',
          precaution: 'Follow label directions and use shade or protective clothing as well.',
          basis: 'guidance', source: 'sun', supplies: ['sunscreen'],
        },
      ],
    },
    {
      id: 'evening', timing: 'At the end of the day', steps: [
        {
          id: 'evening-cleanse', title: 'Wash off the day', kind: 'core',
          action: 'Cleanse gently to remove sunscreen and daily buildup.',
          why: 'Cleansing removes surface buildup without the friction of scrubbing.',
          basis: 'guidance', source: 'face', supplies: ['cleanser', 'towel'],
        },
        {
          id: 'evening-moisturize', title: 'Moisturize after washing', kind: 'core',
          action: 'Apply moisturizer while your skin is slightly damp.',
          why: 'Applying moisturizer to damp skin helps retain moisture.',
          basis: 'guidance', source: 'skin', supplies: ['moisturizer'],
        },
      ],
    },
    { id: 'periodic', timing: 'Between daily routines', steps: [] },
    {
      id: 'as-needed', timing: 'During time outdoors', steps: [
        {
          id: 'reapply', title: 'Reapply sunscreen outdoors', kind: 'conditional',
          action: 'Reapply about every two hours outdoors and after swimming or sweating.',
          why: 'Sunscreen wears off over time and can wash away with water or sweat.',
          basis: 'guidance', source: 'sun', supplies: ['sunscreen'],
        },
      ],
    },
  ],
  experiment: {
    id: 'face-routine-cue', title: 'An evening routine cue',
    hypothesis: 'Doing face care after brushing my teeth will make the routine easier to remember.',
    variable: 'The cue for starting the evening routine.',
    prompt: 'Compare how easy the cue was to remember and how well it fit your evening.',
    stop: 'Stop using the cue if it makes the routine harder to fit in.',
  },
  escalation: 'Ask a dermatologist about persistent irritation or a specific skin concern.',
} satisfies CareModule<(typeof faceInventory)[number]['id']>;

export const modules: readonly CareModule[] = [hair, nails, face];
