// Includes native, established introduced, and migratory fish recorded in Norwegian freshwater.
// Dropdown labels include Latin names, while the selected value is only the Norwegian name.
// Informal synonyms are intentionally omitted.
const fishSpecies = [
  ['Abbor', 'Perca fluviatilis'],
  ['Asp', 'Aspius aspius'],
  ['Bekkeniøye', 'Lampetra planeri'],
  ['Bekkerøye', 'Salvelinus fontinalis'],
  ['Brasme', 'Abramis brama'],
  ['Dvergmalle', 'Ameiurus nebulosus'],
  ['Elveniøye', 'Lampetra fluviatilis'],
  ['Flire', 'Blicca bjoerkna'],
  ['Gjedde', 'Esox lucius'],
  ['Gjørs', 'Sander lucioperca'],
  ['Gullbust', 'Leuciscus leuciscus'],
  ['Gullfisk', 'Carassius auratus'],
  ['Harr', 'Thymallus thymallus'],
  ['Havniøye', 'Petromyzon marinus'],
  ['Hork', 'Gymnocephalus cernua'],
  ['Hvitfinnet steinulke', 'Cottus gobio'],
  ['Karpe', 'Cyprinus carpio'],
  ['Karuss', 'Carassius carassius'],
  ['Kanadarøye', 'Salvelinus namaycush'],
  ['Krøkle', 'Osmerus eperlanus'],
  ['Lake', 'Lota lota'],
  ['Laue', 'Alburnus alburnus'],
  ['Lagesild', 'Coregonus albula'],
  ['Laks', 'Salmo salar'],
  ['Mort', 'Rutilus rutilus'],
  ['Nipigget stingsild', 'Pungitius pungitius'],
  ['Pukkellaks', 'Oncorhynchus gorbuscha'],
  ['Regnbueørret', 'Oncorhynchus mykiss'],
  ['Rødgjellet solabbor', 'Lepomis gibbosus'],
  ['Røye', 'Salvelinus alpinus'],
  ['Sandkryper', 'Gobio gobio'],
  ['Sik', 'Coregonus lavaretus'],
  ['Skrubbe', 'Platichthys flesus'],
  ['Steinsmett', 'Cottus poecilopus'],
  ['Stam', 'Squalius cephalus'],
  ['Suter', 'Tinca tinca'],
  ['Sørv', 'Scardinius erythrophthalmus'],
  ['Trepigget stingsild', 'Gasterosteus aculeatus'],
  ['Vederbuk', 'Leuciscus idus'],
  ['Ørret', 'Salmo trutta'],
  ['Ørekyte', 'Phoxinus phoxinus'],
  ['Ål', 'Anguilla anguilla']
]

export const norwegianFreshwaterFish = fishSpecies
  .map(([name, scientificName]) => ({
    name,
    scientificName,
    label: `${name} - ${scientificName}`
  }))
  .sort((first, second) => first.name.localeCompare(second.name, 'nb'))
