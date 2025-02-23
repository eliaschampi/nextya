<script>
	export let data;
</script>

<h1>Lista de Usuarios</h1>
<ul>
	{#each data.users as user}
		<li>{user.name} - {user.email}</li>
	{/each}
</ul>
