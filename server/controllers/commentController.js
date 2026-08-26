import prisma from "../configs/prisma.js";


// add comment
export const addComment=async(req,res)=>{
    try {
        const {userId}=await req.auth();
        const {content,tastId}=req.body;

        // check user is project member
        const task=await prisma.task.findUnique({
            where:{
                id:tastId,
            }
        })

        const project=await prisma.project.findUnique({
            where:{id:task.projectId},
            include:{members:{include:{user:true}}}
        })

        if(!project) return res.status(404).json({message:"Project not found"});

        const member=project.members.find((m)=>m.userId===userId);
        if(!member) return res.status(403).json({message:"You are not a member of this project"});

        const comment=await prisma.comment.create({
            data:{
                tastId,
                content,
                userId
            },
            include:{user:true}
        })

        res.json({message:"Comment added successfully",comment})
    } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
    }
}