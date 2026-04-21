import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useBusLocation(busId) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!busId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'busLocations', busId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setLocation({
            lat: data.lat,
            lng: data.lng,
            speed: data.speed,
            timestamp: data.timestamp,
            tripStatus: data.tripStatus,
            tripStartedAt: data.tripStartedAt,
          });
        } else {
          setLocation(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('useBusLocation error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [busId]);

  return { location, loading, error };
}
