<?php include('head.html'); ?>
<link type="text/css" rel="stylesheet" media="screen" href="https://cdn.conversejs.org/3.2.1/css/converse.min.css" />
<link type="text/css" rel="stylesheet" media="screen" href="css/mockup.css" />
</head>

<body>
	<?php include('menu.html'); ?>
	<div class="container converse-bg">
		<h1 class="brand-heading"><i class="icon-conversejs"></i>&nbsp;inVerse</h1>
	</div>

	<div id="conversejs" class="login">
		<div id="controlbox" class="chatbox">
			<div class="flyout box-flyout">
				<div class="controlbox-panes">
					<div id="login-dialog" class="controlbox-pane">
						<div class="row">
							<div class="col-12">
								<h1 class="brand-heading">
									<i class="icon-conversejs"></i> inVerse</h1>
								<p>
									<a href="https://conversejs.org">Open Source</a><br />XMPP chat client</p>
							</div>

							<div class="col-12">
								<form class="pure-form converse-form">
									<div class="form-group">
										<label for="jid">XMPP Username:</label>
										<input type="text" name="jid" class="form-control" placeholder="user@server" autocomplete="off">
									</div>
									<div class="form-group">
										<label for="password">Password:</label>
										<input type="password" name="password" class="form-control" placeholder="password" autocomplete="off">
									</div>
									<p></p>
									<p><input class="btn btn-primary" type="submit" value="Log In"></p>
									<p>Click <a href="#" data-toggle="modal" data-target="#registerModal">here</a> to register.</p>
								</form>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Register Modal -->
	<div class="modal fade" id="registerModal" tabindex="-1" role="dialog" aria-labelledby="registerModalLabel" aria-hidden="true">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="registerModalLabel">Register</h5>
					<button type="button" class="close" data-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<form id="converse-register">
						<div class="form-group">
							<label for="domain">Your XMPP provider's domain name:</label>
							<input type="text" name="domain" class="form-control" placeholder=" e.g. conversejs.org">
						</div>
						<p>Tip: A list of public XMPP providers is available
							<a href="https://xmpp.net/directory.php" class="url" target="_blank" rel="noopener">here</a>.</p>
						<input class="btn btn-primary" type="submit" value="Fetch registration form">
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>
</body>

</html>
