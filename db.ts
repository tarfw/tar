import 'react-native-event-source';
import { init } from '@instantdb/react-native';
import schema from './instant.schema';

// Instant app
const APP_ID = process.env.EXPO_PUBLIC_INSTANT_APP_ID || '1be71d54-11aa-4705-a2b1-e96753009db4';

const db = init({ appId: APP_ID, schema });

export default db;
