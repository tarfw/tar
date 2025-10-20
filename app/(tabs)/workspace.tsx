import React from 'react';
import { Text, View, ScrollView, TouchableOpacity } from 'react-native';

export default function Workspace() {
  const [activeFilter, setActiveFilter] = React.useState('Today');

  const projects = [
    {
      id: 'food-order',
      name: 'Pickup Food Order',
      tasks: [
        { id: 1, title: 'Confirm order', status: 'completed', progress: 100 },
        { id: 2, title: 'Pick up order', status: 'in-progress', progress: 50 },
        { id: 3, title: 'Deliver order', status: 'pending', progress: 0 },
      ],
    },
    {
      id: 'website-redesign',
      name: 'Website Redesign',
      tasks: [
        { id: 4, title: 'Design homepage layout', status: 'completed', progress: 100 },
        { id: 5, title: 'User research analysis', status: 'in-progress', progress: 75 },
        { id: 6, title: 'Implement responsive design', status: 'pending', progress: 0 },
      ],
    },
    {
      id: 'marketing-campaign',
      name: 'Q4 Marketing Campaign',
      tasks: [
        { id: 7, title: 'Create campaign strategy', status: 'completed', progress: 100 },
        { id: 8, title: 'Design social media assets', status: 'in-progress', progress: 60 },
        { id: 9, title: 'Launch campaign', status: 'pending', progress: 0 },
      ],
    },
  ];

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in-progress': return '#f59e0b';
      default: return '#d1d5db';
    }
  };

  const renderTaskRow = (task: any) => (
    <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: getProgressColor(task.status), justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
        {task.status === 'completed' && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getProgressColor(task.status) }} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>{task.title}</Text>
        <Text style={{ fontSize: 14, color: '#9ca3af' }}>{task.status === 'completed' ? 'Completed' : task.status === 'in-progress' ? 'In Progress' : 'Pending'}</Text>
      </View>
    </View>
  );

  const renderProject = (project: any) => {
    const filteredTasks = project.tasks.filter((task: any) => {
      switch (activeFilter) {
        case 'Today': return true; // For demo, show all tasks
        case 'Upcoming': return task.status === 'pending';
        case 'Completed': return task.status === 'completed';
        default: return true;
      }
    });

    if (filteredTasks.length === 0) return null;

    return (
      <View key={project.id} style={{ marginBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937' }}>{project.name}</Text>
        </View>
        {filteredTasks.map(renderTaskRow)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ margin: 10, padding: 5 }}>
        <View style={{ height: 300, borderRadius: 10, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 10 }}>
          <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 20 }}>current task</Text>
        </View>
      </View>

      {/* Top Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        {['Today', 'Upcoming', 'Completed'].map((filter) => (
          <TouchableOpacity key={filter} onPress={() => setActiveFilter(filter)}>
            <Text style={{
              fontSize: 16,
              fontWeight: '500',
              color: activeFilter === filter ? '#6366f1' : '#6b7280'
            }}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task Projects */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {projects.map(renderProject)}
      </ScrollView>
    </View>
  );
}
