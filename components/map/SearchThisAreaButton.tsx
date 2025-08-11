import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface SearchThisAreaButtonProps {
  showSearchButton: boolean;
  isSearching: boolean;
  onSearchThisArea: () => void;
}

export const SearchThisAreaButton: React.FC<SearchThisAreaButtonProps> = ({
  showSearchButton,
  isSearching,
  onSearchThisArea,
}) => {
  if (!showSearchButton && !isSearching) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isSearching && styles.buttonSearching]}
        onPress={onSearchThisArea}
        disabled={isSearching}
        activeOpacity={0.8}
      >
        {isSearching ? (
          <View style={styles.searchingContent}>
            <ActivityIndicator size="small" color="#6B7280" />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🔍 Search this area</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  buttonSearching: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  buttonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  searchingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchingText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
});