import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SectionList,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useMemoryStore } from '../../hooks/use-memory-store';
import { dbHelpers, subscribeToDbChanges } from '../../lib/db';
import { useEmbeddingService } from '../../lib/embedding-service';

/**
 * TRACE SCREEN
 * Displays real data from Turso with Semantic Search.
 */

interface TraceItem {
    id: string;
    title: string;
    type: 'actor' | 'node' | 'event';
    subtitle?: string;
}

interface TraceSection {
    title: string;
    data: TraceItem[];
}

export default function TraceScreen() {
    const [sections, setSections] = useState<TraceSection[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<TraceItem[] | null>(null);

    const { setMemory } = useMemoryStore();
    const { generateEmbedding, isEmbeddingReady, isEmbeddingGenerating } = useEmbeddingService();

    const fetchData = async () => {
        try {
            const [actors, nodes, events] = await Promise.all([
                dbHelpers.getActors(),
                dbHelpers.getNodes(),
                dbHelpers.getEvents()
            ]);

            const newSections: TraceSection[] = [
                {
                    title: 'Actors',
                    data: actors.map((a: any) => ({
                        id: a.id,
                        title: a.name,
                        type: 'actor' as const,
                        subtitle: a.actortype
                    }))
                },
                {
                    title: 'Nodes',
                    data: nodes.map((n: any) => ({
                        id: n.id,
                        title: n.title,
                        type: 'node' as const,
                        subtitle: n.nodetype
                    }))
                },
                {
                    title: 'OR Events',
                    data: events.map((e: any) => ({
                        id: e.id,
                        title: e.scope,
                        type: 'event' as const,
                        subtitle: e.status
                    }))
                }
            ].filter(section => section.data.length > 0) as TraceSection[];

            setSections(newSections);
        } catch (error) {
            console.error('[Trace] Fetch error:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const unsubscribe = subscribeToDbChanges(fetchData);
        return () => {
            unsubscribe();
        };
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !isEmbeddingReady) {
            setSearchResults(null);
            return;
        }

        setIsSearching(true);
        try {
            const vector = await generateEmbedding(searchQuery);
            if (vector) {
                const nodeResults = await dbHelpers.semanticSearchNodes(vector, 10);
                setSearchResults(nodeResults.map((n: any) => ({
                    id: n.id,
                    title: n.title,
                    type: 'node',
                    subtitle: `Match: ${(1 - n.distance).toFixed(2)}`
                })));
            }
        } catch (error) {
            console.error('[Trace] Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (searchQuery === '') {
            setSearchResults(null);
        }
    }, [searchQuery]);

    const renderItem = ({ item }: { item: TraceItem }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => setMemory(item.title)}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                    name={
                        item.type === 'actor' ? 'account' :
                            item.type === 'node' ? 'database' : 'lightning-bolt'
                    }
                    size={20}
                    color="#006AFF"
                />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#8E8E93" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Semantic search across memory..."
                        placeholderTextColor="#8E8E93"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {(isSearching || isEmbeddingGenerating) && (
                        <ActivityIndicator size="small" color="#006AFF" />
                    )}
                </View>
            </View>

            {searchResults ? (
                <SectionList
                    sections={[{ title: 'Search Results', data: searchResults }]}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title}</Text>
                    )}
                    renderItem={renderItem}
                />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title}</Text>
                    )}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="database-off" size={48} color="#D1D1D6" />
                            <Text style={styles.emptyText}>No data in local memory.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: '#000',
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 24,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F7FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        marginTop: 12,
        color: '#8E8E93',
        fontSize: 15,
    },
});
