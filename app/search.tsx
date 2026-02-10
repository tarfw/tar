import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { dbHelpers } from '../lib/db';
import { useEmbeddingService } from '../lib/embedding-service';

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const { generateEmbedding, isEmbeddingReady, isEmbeddingGenerating, embeddingError } = useEmbeddingService();
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        console.log('[Search] Embedding Service State:', { isEmbeddingReady, isEmbeddingGenerating, embeddingError });
    }, [isEmbeddingReady, isEmbeddingGenerating, embeddingError]);

    const handleSearch = async () => {
        if (!query.trim() || !isEmbeddingReady) return;

        setIsSearching(true);
        try {
            const vector = await generateEmbedding(query);
            if (vector) {
                const nodeResults = await dbHelpers.semanticSearchNodes(vector, 10);
                setResults(nodeResults);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Semantic Search</Text>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <TextInput
                        style={styles.input}
                        placeholder="Search concepts (e.g. smart home)..."
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={!isEmbeddingReady || isSearching || isEmbeddingGenerating}
                    >
                        {isSearching || isEmbeddingGenerating ? (
                            <ActivityIndicator size="small" color="#006AFF" />
                        ) : (
                            <MaterialCommunityIcons name="magnify" size={24} color={isEmbeddingReady ? "#006AFF" : "#CCC"} />
                        )}
                    </TouchableOpacity>
                </View>
                {!isEmbeddingReady && !embeddingError && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#006AFF" />
                        <Text style={styles.loadingText}>Initializing AI (Downloading 80MB model)...</Text>
                    </View>
                )}
                {embeddingError && (
                    <View style={styles.errorContainer}>
                        <MaterialCommunityIcons name="alert-circle" size={24} color="#FF3B30" />
                        <Text style={styles.errorText}>AI Ready: {isEmbeddingReady ? 'Yes' : 'No'}</Text>
                        <Text style={styles.errorText}>Error: {embeddingError.message || 'Check connection'}</Text>

                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => router.replace('/search')}
                        >
                            <Text style={styles.retryButtonText}>Reload Search</Text>
                        </TouchableOpacity>

                        <Text style={styles.errorHint}>If this persists, verify your internet and ensure you're in a Dev Build.</Text>
                    </View>
                )}
            </View>

            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.resultItem}>
                        <Text style={styles.resultTitle}>{item.title}</Text>
                        <Text style={styles.resultType}>{item.nodetype}</Text>
                        <Text style={styles.resultDistance}>Similarity: {(1 - item.distance).toFixed(4)}</Text>
                    </View>
                )}
                ListEmptyComponent={
                    !isSearching && query.length > 0 ? (
                        <Text style={styles.emptyText}>No semantically related items found.</Text>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    searchSection: {
        padding: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    loadingContainer: {
        marginTop: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#006AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 15,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    listContent: {
        padding: 20,
    },
    resultItem: {
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    resultType: {
        fontSize: 12,
        color: '#006AFF',
        marginTop: 2,
    },
    resultDistance: {
        fontSize: 10,
        color: '#999',
        marginTop: 4,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#999',
    },
    errorContainer: {
        marginTop: 15,
        alignItems: 'center',
        backgroundColor: '#FFF5F5',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFDCDC',
    },
    errorText: {
        color: '#FF3B30',
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },
    errorHint: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    }
});
