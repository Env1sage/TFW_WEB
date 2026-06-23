import Lottie from 'lottie-react';

const bouncingDots = {
  v: '5.5.7', fr: 30, ip: 0, op: 60, w: 120, h: 60, ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: 'Dot1', ip: 0, op: 60, sr: 1, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 1, k: [
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 0,  s: [20, 40, 0] },
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 15, s: [20, 14, 0] },
          { t: 30, s: [20, 40, 0] },
        ]},
        a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [16, 16] } },
        { ty: 'fl', c: { a: 0, k: [0.055, 0.486, 0.380, 1] }, o: { a: 0, k: 100 } },
      ],
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: 'Dot2', ip: 0, op: 60, sr: 1, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 1, k: [
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 5,  s: [60, 40, 0] },
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 20, s: [60, 14, 0] },
          { t: 35, s: [60, 40, 0] },
        ]},
        a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [16, 16] } },
        { ty: 'fl', c: { a: 0, k: [0.776, 0.655, 0.369, 1] }, o: { a: 0, k: 100 } },
      ],
    },
    {
      ddd: 0, ind: 3, ty: 4, nm: 'Dot3', ip: 0, op: 60, sr: 1, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 1, k: [
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 10, s: [100, 40, 0] },
          { i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 }, t: 25, s: [100, 14, 0] },
          { t: 40, s: [100, 40, 0] },
        ]},
        a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [16, 16] } },
        { ty: 'fl', c: { a: 0, k: [0.055, 0.627, 0.490, 1] }, o: { a: 0, k: 100 } },
      ],
    },
  ],
};

const successCheck = {
  v: '5.5.7', fr: 30, ip: 0, op: 90, w: 200, h: 200, ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: 'Circle', ip: 0, op: 90, sr: 1, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [
          { i: { x: [0.34], y: [1.56] }, o: { x: [0.5], y: [0] }, t: 0,  s: [0,  0,  100] },
          { t: 22, s: [100, 100, 100] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [150, 150] } },
        { ty: 'fl', c: { a: 0, k: [0.055, 0.486, 0.380, 1] }, o: { a: 0, k: 100 } },
      ],
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: 'Check', ip: 0, op: 90, sr: 1, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: 'sh',
          ks: { a: 0, k: { i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[-30, 4], [-10, 24], [32, -20]], c: false } },
        },
        { ty: 'st', c: { a: 0, k: [1,1,1,1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 9 }, lc: 2, lj: 2 },
        { ty: 'tm', s: { a: 0, k: 0 }, e: { a: 1, k: [
          { i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 22, s: [0] },
          { t: 50, s: [100] },
        ]}},
      ],
    },
  ],
};

interface Props {
  type?: 'dots' | 'success';
  size?: number;
  loop?: boolean;
}

export function LottieLoader({ type = 'dots', size = 90, loop = true }: Props) {
  const data = type === 'success' ? successCheck : bouncingDots;
  const w = type === 'dots' ? size * 1.5 : size;
  return (
    <div style={{ width: w, height: size, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Lottie animationData={data} loop={loop} style={{ width: w, height: size }} />
    </div>
  );
}
