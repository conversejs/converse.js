<?php include('head.html'); ?>
<link type="text/css" rel="stylesheet" media="screen" href="https://cdn.conversejs.org/3.2.1/css/inverse.min.css" />
<link type="text/css" rel="stylesheet" media="screen" href="css/mockup.css" />
</head>

<body>
	<?php include('menu.html'); ?>

	<div class="container-fluid">
		<div id="conversejs" class="fullscreen chatbox">
			<div id="controlbox" class="chatbox">
				<div class="flyout box-flyout">
					<div class="controlbox-panes">
						<div class="row">
							<div class="col-xl-2 col-md-3">
								<?php include('sidebar.html'); ?>
								<?php include('user-panel.html'); ?>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="chatbox" id="37c0c87392010303765fe36b05c0967d62c6b70f">
				<div class="row">
					<div class="col-xl-10 offset-xl-2 col-md-9 offset-md-3">
						<div class="flyout box-flyout">
							<div class="chat-head chat-head-chatbox d-flex">
								<div><canvas height="44" width="44" class="avatar"></canvas></div>
								<div class="chat-title w-100">JC Brand
									<p class="user-custom-message" title="10000ft in the air">10000ft in the air</p>
								</div>
								<a class="chatbox-btn fa fa-vcard" title="Contact profile" data-toggle="modal" data-target="#contactProfileModal"></a>
								<a class="chatbox-btn fa fa-close" title="Close this chat box"></a>
							</div>

							<div class="chat-body">
								<div class="chat-content">
									<div class="chat-info">
										<span class="badge badge-info">This is an info message</span></div>
									<div class="chat-info">
										<span class="badge badge-danger">This is an error message</span></div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-me">09:35&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-me">me:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Hello world
											<span class="fa fa-smile-o"></span>
										</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-them">19:25&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-them">Benedict-John:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Dagsê</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-me">19:39&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-me">me:&nbsp;</span>
										</span>
										<span class="chat-msg-content">This is a relatively long message to check that wrapping works as expected.</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-me">19:42&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-me">me:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Supercalifragilisticexpialidociousstillnotlongenough</span>
									</div>
									<div class="chat-info chat-event">
										<span class="badge badge-success">JC Brand is busy</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-me">19:43&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-me">me:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Another message to check that scrolling works.</span>
									</div>
								</div>

								<form class="sendXMPPMessage">
									<div class="form-group">
										<ul class="chat-toolbar no-text-select">
											<li class="toggle-toolbar-menu toggle-smiley fa fa-smile-o" title="Insert a smiley">
												<div class="emoji-picker-container toolbar-menu collapsed"></div>
											</li>

											<li class="toggle-clear">
												<a class="fa fa-trash" title="Clear all messages"></a>
											</li>

											<li class="toggle-toolbar-menu toggle-otr unencrypted" title="Your messages are not encrypted. Click here to enable OTR encryption.">
												<span class="chat-toolbar-text">unencrypted</span>
												<span class="fa fa-unlock"></span>
												<ul class="toolbar-menu collapsed">
													<li>
														<a class="start-otr" href="#">Start encrypted conversation</a>
													</li>
													<li>
														<a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank" rel="noopener">What's this?</a>
													</li>
												</ul>
											</li>
										</ul>
									</div>
									<div class="form-group">
										<textarea class="form-control" placeholder="Personal message"></textarea>
									</div>
								</form>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Contact Profile Modal -->
		<div class="modal fade" id="contactProfileModal" tabindex="-1" role="dialog" aria-labelledby="contactProfileModalLabel" aria-hidden="true">
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title" id="contactProfileModalLabel">JC Brand User Profile</h5>
						<button type="button" class="close" data-dismiss="modal" aria-label="Close">
							<span aria-hidden="true">&times;</span>
						</button>
					</div>
					<div class="modal-body">
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
					</div>
				</div>
			</div>
		</div>

		<?php include('modals.html'); ?>
	</div>
</body>
</html>
