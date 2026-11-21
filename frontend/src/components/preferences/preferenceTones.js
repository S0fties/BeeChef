import { AlertTriangle, Ban, Heart } from 'lucide-react'

// One entry per preference kind. Class names are written out in full so Tailwind can see them.
export const PREFERENCE_TONES = {
  preferred: {
    title: 'Preferred',
    description: 'Ingredients you enjoy. Suggestions will favor them.',
    addLabel: 'Add preference',
    empty: 'No preferred ingredients yet.',
    icon: Heart,
    iconBox: 'bg-[#e7f4ea] text-[#266838]',
    badge: 'bg-[#e7f4ea] text-[#266838]',
    tileSelected: 'border-[#36583b] bg-[#f0f7ee]',
    check: 'border-[#36583b] bg-[#36583b] text-white',
    chip: 'border-[#cfe0c9] bg-[#f6faf3]',
  },
  restricted: {
    title: 'Restricted',
    description: 'Ingredients you avoid. They will not appear in suggestions.',
    addLabel: 'Add restriction',
    empty: 'No restricted ingredients yet.',
    icon: Ban,
    iconBox: 'bg-[#fdf1d8] text-[#8a5a00]',
    badge: 'bg-[#fdf1d8] text-[#8a5a00]',
    tileSelected: 'border-[#e0b44a] bg-[#fffaf0]',
    check: 'border-[#c8922a] bg-[#c8922a] text-white',
    chip: 'border-[#ecd9a8] bg-[#fffaf0]',
  },
  allergic: {
    title: 'Allergic',
    description: 'Ingredients that are unsafe for you. Always excluded.',
    addLabel: 'Add allergy',
    empty: 'No allergic ingredients yet.',
    icon: AlertTriangle,
    iconBox: 'bg-[#fdecea] text-[#b42318]',
    badge: 'bg-[#fdecea] text-[#b42318]',
    tileSelected: 'border-[#d92d20] bg-[#fdf2f2]',
    check: 'border-[#d92d20] bg-[#d92d20] text-white',
    chip: 'border-[#f5c2c0] bg-[#fdf2f2]',
  },
}