import type { ImageSourcePropType } from 'react-native';

import type { CropCode } from './cropCatalog';

/**
 * Bundled crop photos (assets/crops, 480px squares from Wikimedia Commons). Metro needs literal
 * require() paths, so each one is listed. Authors and licenses: assets/crops/CREDITS.md.
 */
export const cropImages: Record<CropCode, ImageSourcePropType> = {
  paddy: require('../../assets/crops/paddy.jpg'),
  maize: require('../../assets/crops/maize.jpg'),
  jowar: require('../../assets/crops/jowar.jpg'),
  cotton: require('../../assets/crops/cotton.jpg'),
  sugarcane: require('../../assets/crops/sugarcane.jpg'),
  banana: require('../../assets/crops/banana.jpg'),
  mango: require('../../assets/crops/mango.jpg'),
  groundnut: require('../../assets/crops/groundnut.jpg'),
  castor: require('../../assets/crops/castor.jpg'),
  oil_palm: require('../../assets/crops/oil_palm.jpg'),
  sunflower: require('../../assets/crops/sunflower.jpg'),
  bengal_gram: require('../../assets/crops/bengal_gram.jpg'),
  black_gram: require('../../assets/crops/black_gram.jpg'),
  green_gram: require('../../assets/crops/green_gram.jpg'),
  red_gram: require('../../assets/crops/red_gram.jpg'),
  chilli: require('../../assets/crops/chilli.jpg'),
  turmeric: require('../../assets/crops/turmeric.jpg'),
  onion: require('../../assets/crops/onion.jpg'),
  tomato: require('../../assets/crops/tomato.jpg'),
};
