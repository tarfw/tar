import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { db } from '../../lib/db';

interface Person {
  id: string;
  title?: string;
  profile?: string;
  status?: string;
}

const PersonCard = ({ person }: { person: Person }) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return '#10b981';
      case 'away':
        return '#f59e0b';
      case 'busy':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.profileContainer}>
        {person.profile ? (
          <Image source={{ uri: person.profile }} style={styles.profileImage} />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.initials}>
              {person.title ? getInitials(person.title) : 'U'}
            </Text>
          </View>
        )}
        {person.status && (
          <View 
            style={[
              styles.statusIndicator, 
              { backgroundColor: getStatusColor(person.status) }
            ]} 
          />
        )}
      </View>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>
          {person.title || 'Unknown User'}
        </Text>
        {person.status && (
          <Text style={styles.personStatus}>
            {person.status}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function People() {
  const { data: peoples, isLoading, error } = db.useQuery({
    peoples: {}
  });

  const renderPerson = ({ item }: { item: Person }) => (
    <PersonCard person={item} />
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading people...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error loading people</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={peoples?.peoples || []}
        renderItem={renderPerson}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No people found</Text>
            <Text style={styles.emptySubtext}>Add some contacts to get started</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e5ea',
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 2,
  },
  personStatus: {
    fontSize: 15,
    color: '#8e8e93',
    textTransform: 'capitalize',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#c6c6c8',
    marginLeft: 72,
  },
  loadingText: {
    fontSize: 17,
    color: '#8e8e93',
  },
  errorText: {
    fontSize: 17,
    color: '#ff3b30',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8e8e93',
  },
});