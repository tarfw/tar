import React from 'react';
import { Text, View, ScrollView } from 'react-native';

export default function Workspace() {

  const projects = [
    {
      id: 'food-order',
      name: 'Food Order',
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
      name: 'Marketing Campaign',
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
    <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: getProgressColor(task.status), justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
      </View>
      <Text style={{ fontSize: 18, color: task.status === 'completed' ? '#9ca3af' : '#374151' }}>{task.title}</Text>
    </View>
  );

  const renderProject = (project: any) => {
    return (
      <View key={project.id} style={{ marginBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>{project.name}</Text>
        </View>
        {project.tasks.map(renderTaskRow)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ margin: 10, padding: 5 }}>
        <View style={{ height: 450, borderRadius: 10, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 10 }}>
          <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 20 }}>current task</Text>
        </View>
      </View>

      {/* Task Projects */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {projects.map(renderProject)}
      </ScrollView>
    </View>
  );
}
