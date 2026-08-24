import prisma from "../configs/prisma.js"

// Create task
export const createTask=async(req,res)=>{
    try {
        const {userId}=await req.auth();
        const {projectId,name,description,type,status,dueDate,assigneeId}=req.body;

      const origin=req.get("origin");

//   check if user has admin role for project
const project=await prisma.project.findUnique({
    where:{id:projectId},
    include:{members:{include:{user:true}}}
})

if(!project){
    return res.status(404).json({
        message:'Project not found'
    })
}else if(project.team_lead!==userId){
  return res.status(403).json({
        message:'Your dont have admin privileges for this project'
    })
}

if(assigneeId && !project.members.find((member)=>member.user.id===assigneeId)){
    return res.status(403).json({
        message:'Assignee is not a member of this project / workspace'
    })
}

const task=await prisma.task.create({
    data:{
        projectId,
        name,
        description,
        priority,
        assigneeId,
        status,
        due_date:new Date(dueDate),
    }
})

const taskWithAssignee=await prisma.task.findUnique({
    where:{id:task.id},
    include:{assignee:true}
})

return res.status(201).json({
    task:taskWithAssignee,
    message:'Task created successfully',
})      
    } catch (error) {
        console.log(error);
    res.status(500).json({ message: error.code || error.message });
    }
}


// Update task
export const updateTask=async(req,res)=>{
    try {
        const task=await prisma.task.findUnique({
            where:{id:req.params.id},
        })
        if(!task){
            return res.status(404).json({
                message:'Task not found'
            })
        }


        const {userId}=await req.auth();

const project=await prisma.project.findUnique({
    where:{id:task.projectId},
    include:{members:{include:{user:true}}}
})

if(!project){
    return res.status(404).json({
        message:'Project not found'
    })
}else if(project.team_lead!==userId){
  return res.status(403).json({
        message:'Your dont have admin privileges for this project'
    })
}

const updatedTask=await prisma.task.update({
    where:{id:req.params.id},
    data:req.body
})


return res.status(201).json({
    task:updatedTask,
    message:'Task updated successfully',
})      
    } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
    }
}


// Delete task
export const deleteTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { tasksIds } = req.params;

    // Check if task exists
    const tasks = await prisma.task.findMany({
      where: { id: {in:tasksIds} },
    });

    if(tasks.length===0){
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: tasks[0].projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (project.team_lead !== userId) {
      return res.status(403).json({
        message: "You don't have admin privileges for this project",
      });
    }

    // Delete the task
    await prisma.task.deleteMany({
      where: { id: {in:tasksIds} },
    });

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
