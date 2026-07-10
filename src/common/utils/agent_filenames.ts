//The client is only allowed to know the filenames for displaying the characters.
// We do not allow access to worlds/default.yaml as otherwise it would get access to the seeds and so on.
enum AgentFilenames {
    "character_academic_staff_1_1",
    "character_academic_staff_2_1",
    "character_academic_staff_3_1",
    "character_academic_staff_3_2",
    "character_academic_staff_4_1",
    "character_mensa_staff",
    "character_professor_1",
    "character_professor_2",
    "character_professor_3_rieck",
    "character_professor_4",
    "character_student_1",
    "character_student_2",
    "character_student_3",
    //We use a placeholder value for the last entry in enum class to get the length of the whole enumeration.
    length
}

export default AgentFilenames;
