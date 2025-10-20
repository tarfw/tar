import 'react-native-event-source';
import { init } from '@instantdb/react-native';
import schema from './instant.schema';

// Instant app
const APP_ID = process.env.EXPO_PUBLIC_INSTANT_APP_ID || '__APP_ID__';

const db = init({ appId: APP_ID, schema });

export default db;
