import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useMemoryStore } from '../../hooks/use-memory-store';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { dbHelpers, subscribeToDbChanges } from '../../lib/db';
import { useEmbeddingService } from '../../lib/embedding-service';


/**
 * TRACE SCREEN
 * Displays real data from Turso with Semantic Search.
 */

export default function TraceScreen() {
    const router = useRouter();
    const { memory: activeTab, setMemory: setActiveTab } = useMemoryStore();
    const colors = useThemeColors();
    const { colorScheme } = useColorScheme();

    const [tableData, setTableData] = useState<Record<string, any[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);


    const { generateEmbedding, isEmbeddingReady, isEmbeddingGenerating } = useEmbeddingService();

    const fetchData = async () => {
        try {
            const [actors, nodes, events, collab, points, streams, streamcollab] = await Promise.all([
                dbHelpers.getActors(),
                dbHelpers.getNodes(),
                dbHelpers.getEvents(),
                dbHelpers.getCollab(),
                dbHelpers.getPoints(),
                dbHelpers.getStreams(),
                dbHelpers.getStreamCollab()
            ]);

            setTableData({
                actors,
                nodes,
                orevents: events,
                collab,
                points,
                streams,
                streamcollab
            });
        } catch (error) {
            console.error('[Trace] Fetch error:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const unsubscribe = subscribeToDbChanges(fetchData);

        // Default to orevents if memory store is empty or 'Memory'
        if (activeTab === 'Memory') {
            setActiveTab('orevents');
        }

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
                // Perform multiple searches in parallel
                const [nodeResults, actorResults, eventResults] = await Promise.all([
                    dbHelpers.semanticSearchNodes(vector, 5),
                    dbHelpers.semanticSearchActors(vector, 5),
                    dbHelpers.semanticSearchEvents(vector, 5)
                ]);

                // Map to common result format
                const formattedNodes = nodeResults.map((n: any) => ({
                    ...n,
                    id: n.id,
                    title: n.title,
                    type: 'nodes',
                    subtitle: n.nodetype,
                    distance: n.distance
                }));

                const formattedActors = actorResults.map((a: any) => ({
                    ...a,
                    id: a.id,
                    title: a.name,
                    type: 'actors',
                    subtitle: a.actortype,
                    distance: a.distance
                }));

                const formattedEvents = eventResults.map((e: any) => ({
                    ...e,
                    id: e.id,
                    title: e.scope,
                    type: 'orevents',
                    subtitle: e.status,
                    distance: e.distance
                }));

                // Combine and sort by distance (lower is better for cosine distance in Turso)
                const combinedResults = [
                    ...formattedNodes,
                    ...formattedActors,
                    ...formattedEvents
                ].sort((a, b) => a.distance - b.distance);

                setSearchResults(combinedResults);
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

    const renderItem = ({ item }: { item: any }) => {
        let title = '';
        let subtitle = '';
        let typeIcon: any = 'database';
        const itemType = (searchResults && item.type) ? item.type : activeTab;

        switch (itemType) {
            case 'actors':
                title = item.name || item.title;
                subtitle = item.actortype || item.subtitle;
                typeIcon = 'account';
                break;
            case 'nodes':
                title = item.title;
                subtitle = item.nodetype || item.subtitle;
                typeIcon = 'database';
                break;
            case 'orevents':
                const date = new Date(item.ts);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                title = item.scope || item.title;
                subtitle = item.status || item.subtitle;
                typeIcon = 'lightning-bolt';
                return (
                    <TouchableOpacity
                        style={styles.timelineItem}
                        onPress={() => {
                            router.push({
                                pathname: '/mstate',
                                params: {
                                    ...item,
                                    title,
                                    subtitle,
                                    type: 'orevents'
                                }
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.timelineThumbnail,
                            {
                                backgroundColor: item.status === 'success'
                                    ? (colorScheme === 'dark' ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4')
                                    : item.status === 'failed'
                                        ? (colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2')
                                        : (colorScheme === 'dark' ? '#2C2C2E' : '#F8FAFC')
                            }
                        ]}>
                            <MaterialCommunityIcons
                                name={typeIcon}
                                size={18}
                                color={item.status === 'success' ? '#22C55E' : item.status === 'failed' ? '#EF4444' : (colorScheme === 'dark' ? '#94A3B8' : '#64748B')}
                            />
                        </View>

                        <View style={styles.timelineInfo}>
                            <Text style={[styles.timelineTitle, { color: colors.timelineTitle }]} numberOfLines={1}>{title}</Text>
                            <View style={styles.statusBadge}>
                                <View style={[styles.statusDot, { backgroundColor: item.status === 'success' ? '#22C55E' : item.status === 'failed' ? '#EF4444' : '#94A3B8' }]} />
                                <Text style={[styles.statusText, { color: colors.statusText }]}>{subtitle}</Text>
                            </View>
                        </View>

                        <View style={styles.timelineTrailing}>
                            <Text style={[styles.timeLabel, { color: colors.timeLabel }]}>{timeStr}</Text>
                        </View>
                    </TouchableOpacity>
                );
            case 'collab':
                title = item.role;
                subtitle = `Actor: ${item.actorid}`;
                typeIcon = 'account-group';
                break;
            case 'points':
                title = `SKU: ${item.sku}`;
                subtitle = `$${item.price} - Stock: ${item.stock}`;
                typeIcon = 'map-marker';
                break;
            case 'streams':
                title = item.scope;
                subtitle = `By: ${item.createdby}`;
                typeIcon = 'waves';
                break;
            case 'streamcollab':
                title = item.role;
                subtitle = `Actor: ${item.actorid}`;
                typeIcon = 'link';
                break;
            default:
                title = item.id;
        }

        return (
            <TouchableOpacity
                style={[styles.itemContainer, { borderBottomColor: colors.border }]}
                onPress={() => {
                    router.push({
                        pathname: '/mstate',
                        params: {
                            ...item,
                            title,
                            subtitle,
                            type: itemType
                        }
                    });
                }}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F0F7FF' }]}>
                    <MaterialCommunityIcons name={typeIcon} size={20} color={colors.accent} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                    {subtitle && <Text style={[styles.itemSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.searchBar }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.searchBar }]}>
                    <MaterialCommunityIcons name="magnify" size={24} color={colors.secondaryText} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Semantic search across memory..."
                        placeholderTextColor={colors.secondaryText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && !isSearching && !isEmbeddingGenerating && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                            <MaterialCommunityIcons name="close-circle" size={20} color={colors.secondaryText} />
                        </TouchableOpacity>
                    )}
                    {(isSearching || isEmbeddingGenerating) && (
                        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                    )}
                </View>
            </View>


            {searchResults ? (
                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    ListHeaderComponent={<Text style={[styles.sectionHeader, { color: colors.accent }]}>Search Results</Text>}
                />
            ) : (
                <FlatList
                    data={tableData[activeTab] || []}
                    keyExtractor={(item, index) => item.id || `item-${index}`}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondaryBackground }]}>
                                <MaterialCommunityIcons name="database-off" size={48} color={colors.secondaryText} />
                            </View>
                            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No data in {activeTab}.</Text>
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
    header: {
        backgroundColor: '#F2F2F7',
        zIndex: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#000',
        height: '100%',
    },
    clearButton: {
        padding: 4,
        marginRight: 4,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F2F2F7',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F0F7FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    textContainer: {
        flex: 1,
        marginRight: 8,
    },
    itemTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    itemSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 3,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(148, 163, 184, 0.1)',
    },
    timelineThumbnail: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    timelineInfo: {
        flex: 1,
    },
    timelineTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A', // Overridden in renderItem inline for theme awareness
        marginBottom: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    timelineTrailing: {
        marginLeft: 12,
        alignItems: 'flex-end',
    },
    timeLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
});

