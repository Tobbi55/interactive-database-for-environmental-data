import leaflet from 'leaflet'

// Circle markers instead of pin icons
export const redCircle = {
  radius: 6,
  fillColor: '#ff3333',
  color: '#cc0000',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

export const blueCircle = {
  radius: 12,
  fillColor: '#3366ff',
  color: '#0033cc',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

export const orangeCircle = {
  radius: 12,
  fillColor: '#ff9933',
  color: '#ff6600',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

// Keep old icon definitions for backward compatibility if needed
export const redIcon = new leaflet.Icon({
  iconUrl: '/marker-icon-red.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export const blueIcon = new leaflet.Icon({
  iconUrl: '/marker-icon-blue.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export const orangeIcon = new leaflet.Icon({
  iconUrl: '/marker-icon-orange.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})
