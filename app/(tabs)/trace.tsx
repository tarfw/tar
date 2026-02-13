import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
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

const TABLES = [
    { id: 'orevents', name: 'Timeline', icon: 'clock-outline' },
    { id: 'actors', name: 'Actors', icon: 'account' },
    { id: 'nodes', name: 'Nodes', icon: 'database' },
    { id: 'collab', name: 'Collab', icon: 'account-group' },
    { id: 'points', name: 'Points', icon: 'map-marker' },
    { id: 'streams', name: 'Streams', icon: 'waves' },
    { id: 'streamcollab', name: 'Str Collab', icon: 'link' },
];

export default function TraceScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('orevents');
    const [tableData, setTableData] = useState<Record<string, any[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);

    const { setMemory } = useMemoryStore();
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

    const renderItem = ({ item }: { item: any }) => {
        let title = '';
        let subtitle = '';
        let typeIcon: any = 'database';

        switch (activeTab) {
            case 'actors':
                title = item.name;
                subtitle = item.actortype;
                typeIcon = 'account';
                break;
            case 'nodes':
                title = item.title;
                subtitle = item.nodetype;
                typeIcon = 'database';
                break;
            case 'orevents':
                const date = new Date(item.ts);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                title = item.scope;
                subtitle = item.status;
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
                                    type: activeTab
                                }
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        {/* 1. Icon Thumbnail */}
                        <View style={[styles.timelineThumbnail, { backgroundColor: item.status === 'success' ? '#F0FDF4' : item.status === 'failed' ? '#FEF2F2' : '#F8FAFC' }]}>
                            <MaterialCommunityIcons
                                name={typeIcon}
                                size={18}
                                color={item.status === 'success' ? '#22C55E' : item.status === 'failed' ? '#EF4444' : '#64748B'}
                            />
                        </View>

                        {/* 2. Title and Status */}
                        <View style={styles.timelineInfo}>
                            <Text style={styles.timelineTitle} numberOfLines={1}>{title}</Text>
                            <View style={styles.statusBadge}>
                                <View style={[styles.statusDot, { backgroundColor: item.status === 'success' ? '#22C55E' : item.status === 'failed' ? '#EF4444' : '#94A3B8' }]} />
                                <Text style={styles.statusText}>{subtitle}</Text>
                            </View>
                        </View>

                        {/* 3. Time on Right End */}
                        <View style={styles.timelineTrailing}>
                            <Text style={styles.timeLabel}>{timeStr}</Text>
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

        // If it's a search result, override formatting
        if (searchResults && searchResults.includes(item)) {
            title = item.title;
            subtitle = item.subtitle;
            typeIcon = item.type === 'actor' ? 'account' : 'database';
        }

        return (
            <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => {
                    router.push({
                        pathname: '/mstate',
                        params: {
                            ...item,
                            title,
                            subtitle,
                            type: activeTab
                        }
                    });
                }}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name={typeIcon} size={20} color="#006AFF" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
                    {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#C7C7CC" />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons name="magnify" size={24} color="#8E8E93" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Semantic search across memory..."
                            placeholderTextColor="#8E8E93"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && !isSearching && !isEmbeddingGenerating && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                                <MaterialCommunityIcons name="close-circle" size={20} color="#8E8E93" />
                            </TouchableOpacity>
                        )}
                        {(isSearching || isEmbeddingGenerating) && (
                            <ActivityIndicator size="small" color="#006AFF" style={{ marginRight: 8 }} />
                        )}
                    </View>
                </View>

                {!searchResults && (
                    <View style={styles.tabsContainer}>
                        <FlatList
                            data={TABLES}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.tabsList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.tabItem,
                                        activeTab === item.id && styles.tabItemActive
                                    ]}
                                    onPress={() => setActiveTab(item.id)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons
                                        name={item.icon as any}
                                        size={18}
                                        color={activeTab === item.id ? '#006AFF' : '#636366'}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={[
                                        styles.tabText,
                                        activeTab === item.id && styles.tabTextActive
                                    ]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}
            </View>

            {searchResults ? (
                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    ListHeaderComponent={<Text style={styles.sectionHeader}>Search Results</Text>}
                />
            ) : (
                <FlatList
                    data={tableData[activeTab] || []}
                    keyExtractor={(item, index) => item.id || `item-${index}`}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialCommunityIcons name="database-off" size={48} color="#D1D1D6" />
                            </View>
                            <Text style={styles.emptyText}>No data in {activeTab}.</Text>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
        zIndex: 10,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 52, // Increased for better touch
        borderWidth: 1,
        borderColor: '#E5E5EA',
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
    tabsContainer: {
        paddingBottom: 4,
    },
    tabsList: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44, // Touch friendly height
        marginHorizontal: 4,
        borderRadius: 22,
        backgroundColor: '#F2F2F7',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    tabItemActive: {
        backgroundColor: '#F0F7FF',
        borderColor: '#006AFF20',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#636366',
    },
    tabTextActive: {
        color: '#006AFF',
        fontWeight: '700',
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
        paddingVertical: 16, // Increased for better touch
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
        borderBottomColor: '#F1F5F9',
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
        color: '#0F172A',
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
        color: '#64748B',
        textTransform: 'capitalize',
    },
    timelineTrailing: {
        marginLeft: 12,
        alignItems: 'flex-end',
    },
    timeLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
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
        backgroundColor: '#F2F2F7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 16,
        fontWeight: '500',
    },
});
