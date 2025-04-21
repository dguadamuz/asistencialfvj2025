// 🔹 Definir Supabase en el ámbito global
const supabaseUrl = 'https://qqcxntabmbnekeankpld.supabase.co';  
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxY3hudGFibWJuZWtlYW5rcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzMTMxNjEsImV4cCI6MjA1Njg4OTE2MX0.uABYRadXhPLsUjTIEiEnqxvOLbkA0SJBSERx2pHZ4NE';

// 🔹 Asegúrate de crear supabase **antes** de usarlo en cualquier parte del código
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Esperar a que el contenido del DOM se haya cargado completamente
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-button').addEventListener('click', login);
    document.getElementById('group-select').addEventListener('change', loadStudents);
    document.getElementById('save-absences-button').addEventListener('click', saveAbsences);
    document.getElementById('generate-pdf').addEventListener('click', generatePDF);

    // 🔹 Función de inicio de sesión
    async function login() {
        console.log("Iniciando el login");  // Esto debería aparecer en la consola cuando se haga clic en el botón
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
    
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
        if (error) {
            console.error("Error de login:", error);  // Verificar si hay error
            alert("Credenciales incorrectas");
        } else {
            console.log("Login exitoso:", data);  // Verificar si el login fue exitoso
            document.getElementById('login').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            loadGroups();
            
             // Verificamos si el correo es el del administrador
        if (data.user.email === 'admin@lfvj.com') {
            // Mostrar el botón de generar PDF solo si el usuario es admin
            document.getElementById('generate-pdf').style.display = 'block';
        } else {
            // Asegúrate de ocultarlo si no es admin
            document.getElementById('generate-pdf').style.display = 'none';
        }
        }
        
    }
    

});  // Asegúrate de cerrar correctamente el bloque de 'DOMContentLoaded'

// 🔹 Cargar grupos
async function loadGroups() {
    const { data, error } = await supabase.from('groups').select('*').order('name', { ascending: true });

    if (error) {
        console.error('Error al cargar los grupos:', error);
        return;
    }

    const groupSelect = document.getElementById('group-select');
    groupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';

    data.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.text = group.name;
        groupSelect.appendChild(option);
    });
}

// 🔹 Cargar estudiantes por grupo (ordenados por primer apellido)
async function loadStudents() {
    const groupId = document.getElementById('group-select').value;
    if (!groupId) {
        alert("Por favor, selecciona un grupo.");
        return;
    }

    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId);

    if (groupError || groupData.length === 0) {
        console.error('Error al obtener el grupo:', groupError);
        return;
    }

    const groupName = groupData[0].name;

    // Depuración: Verificar que estamos recibiendo el nombre del grupo correctamente
    console.log('Nombre del grupo:', groupName);

    // Consulta para obtener estudiantes ordenados alfabéticamente por apellidos
    const { data, error } = await supabase
        .from('students')
        .select('id, primer_apellido, segundo_apellido, nombre')
        .eq('grupo', groupName)  // Verifica que 'grupo' sea la columna correcta en la tabla 'students'
        .order('primer_apellido', { ascending: true })
        .order('segundo_apellido', { ascending: true })
        .order('nombre', { ascending: true });

    // Depuración: Verificar si estamos recibiendo estudiantes
    console.log('Estudiantes obtenidos:', data);
    if (error) {
        console.error('Error al cargar los estudiantes:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No hay estudiantes en este grupo.');
        return;
    }

    const tbody = document.getElementById('students-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    data.forEach(student => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = `${student.primer_apellido} ${student.segundo_apellido} ${student.nombre}`;

        const absenceCell = row.insertCell(1);
        const absenceInput = document.createElement('input');
        absenceInput.type = 'number';
        absenceInput.value = 0;
        absenceInput.dataset.studentId = student.id;
        absenceCell.appendChild(absenceInput);
    });
}

// 🔹 Guardar ausencias en la base de datos
async function saveAbsences() {
    const month = document.getElementById('month-select').value;
    const subject = document.getElementById('subject-select').value;
    const inputs = document.querySelectorAll('#students-table tbody input');

    const absenceRecords = Array.from(inputs).map(input => ({
        student_id: input.dataset.studentId,
        absence_count: parseInt(input.value, 10),
        month: month,
        subject: subject
    }));

    const { data, error } = await supabase
        .from('student_absences')
        .upsert(absenceRecords);

    if (error) {
        console.error('Error al guardar las ausencias:', error);
        alert('No se pudo guardar la información.');
    } else {
        alert('Ausencias guardadas correctamente.');
    }
}
// Generar PDF
const { jsPDF } = window.jspdf;

// 🔹 Generar un PDF para cada estudiante con un pequeño retraso entre cada uno
async function generatePDF() {
    console.log("🔹 Iniciando generación de PDFs...");

    // Obtener valores seleccionados
    const groupId = document.getElementById('group-select').value;
    const months = ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];

    console.log("ID del grupo seleccionado:", groupId);

    // 🔹 Obtener el nombre del grupo desde Supabase
    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

    if (groupError) {
        console.error("❌ Error al obtener el grupo:", groupError);
        alert("No se pudo obtener el nombre del grupo.");
        return;
    }

    const groupName = groupData.name;
    console.log("Nombre del grupo:", groupName);

    // 🔹 Obtener todas las asignaturas desde Supabase
    const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('name');

    if (subjectsError) {
        console.error("❌ Error al obtener las asignaturas:", subjectsError);
        alert("Error al cargar las asignaturas.");
        return;
    }

    console.log("Asignaturas obtenidas:", subjectsData);

    // 🔹 Obtener los estudiantes del grupo usando el nombre del grupo
    const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, primer_apellido, segundo_apellido, nombre')
        .eq('grupo', groupName);  // Aquí usamos el nombre del grupo

    if (studentsError) {
        console.error("❌ Error al cargar los estudiantes:", studentsError);
        alert("Error al cargar los estudiantes.");
        return;
    }

    console.log("Estudiantes obtenidos:", studentsData);

    // 🔹 Obtener las ausencias de los estudiantes
    const { data: absencesData, error: absencesError } = await supabase
        .from('student_absences')
        .select('student_id, absence_count, subject, month');

    if (absencesError) {
        console.error("❌ Error al cargar las ausencias:", absencesError);
        alert("Error al cargar las ausencias.");
        return;
    }

    console.log("Ausencias obtenidas:", absencesData);

    // 🔹 Generar un PDF para cada estudiante con un pequeño retraso entre cada uno
    for (let i = 0; i < studentsData.length; i++) {
        const student = studentsData[i];

        // Esperar 500ms entre cada PDF para evitar bloqueos
        await new Promise(resolve => setTimeout(resolve, 500));

        // Filtramos las ausencias de este estudiante
        const studentAbsences = absencesData.filter(a => a.student_id === student.id);

        // Crear un nuevo PDF por cada estudiante
        const doc = new jsPDF();

        // Cargar la imagen en el encabezado
        await doc.addImage('https://qqcxntabmbnekeankpld.supabase.co/storage/v1/object/sign/images/pdf.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJpbWFnZXMvcGRmLnBuZyIsImlhdCI6MTc0MTU2NDIwOSwiZXhwIjoxODk5MjQ0MjA5fQ.rA9zsVBGPPWFCfOOd6CQwby_uQD6lJtTtmbFIzPphXQ', 'PNG', 0, 0, 200, 20);

        // Título del informe
        doc.setFontSize(16);
        doc.text('Informe de Ausencias', 80, 25);

        // Información del estudiante, grupo, y mes
        doc.setFontSize(12);
        doc.text(`Estudiante: ${student.primer_apellido} ${student.segundo_apellido} ${student.nombre}`, 10, 30);
        doc.text(`Grupo: ${groupName}`, 150, 30);
       
        // Crear los encabezados de la tabla: Asignaturas y Meses
        const tableHead = ['Asignatura', ...months];

        // Organizar los datos de la tabla
        const tableBody = subjectsData.map(subject => {
            const absenceCounts = months.map(month => {
                // Buscamos la ausencia en la base de datos, asegurándonos de que el mes esté en minúsculas en la base de datos
                const absence = studentAbsences.find(a => a.subject === subject.name && a.month === month.toLowerCase());
                return absence ? absence.absence_count : 0;
            });
            return [subject.name, ...absenceCounts];
        });

        // Crear la tabla con las asignaturas y las ausencias por mes
        doc.autoTable({
            startY: 35,
            head: [tableHead], // Encabezados: Asignaturas y Meses
            body: tableBody,   // Datos: Ausencias por asignatura y mes
        });

        // Espacio para la firma
        doc.text('Firma del Profesor:', 10, doc.lastAutoTable.finalY + 10);
        doc.line(10, doc.lastAutoTable.finalY + 22, 200, doc.lastAutoTable.finalY + 22);

        // Guardar el PDF con el nombre del estudiante
        const fileName = `${student.primer_apellido}_${student.segundo_apellido}_${student.nombre}_ausencias.pdf`;
        console.log(`✅ PDF generado: ${fileName}`);
        doc.save(fileName);
    }

    console.log('🎉 Proceso completado.');
}